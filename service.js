/*
 * TV Dashboard launcher service.
 *
 * TizenBrew runs this file in its own background service (Node.js), where the
 * `tizen` device API is available. The dashboard page cannot launch apps itself,
 * so it asks this service over http://127.0.0.1:8093 (localhost only).
 *
 * Endpoints:
 *   GET /apps            -> [{ id, name, hasIcon }]   installed, visible apps
 *   GET /icon?id=<id>    -> the app's icon image from the TV
 *   GET /launch?ids=a,b  -> tries each ID in order; { ok, id } or { ok:false, error }
 *   POST /ics            -> body: a calendar's https link; returns that .ics file
 *                           (Google's calendar links can't be read by the page directly)
 *   GET /calsetup/start?code=1234&names=[...]  -> opens the one-time setup page
 *   GET /calsetup/result -> { done, cfg } once the setup form has been sent
 *   GET /calsetup/stop   -> closes the setup page
 *
 * Calendar setup page: only while the dashboard's setup screen is open, a small form is
 * served on the TV's Wi-Fi address (port 8094) so calendar links can be pasted from a
 * computer or phone. It needs the 4-digit code shown on the TV, locks after 5 wrong codes,
 * and closes after saving, on cancel, or after 10 minutes. Links are handed to the
 * dashboard, which keeps them only in the TV's local storage.
 *
 * Written as ES5 for the older Node.js runtime on Tizen 4.0.
 */
(function () {
  'use strict';

  var http = require('http');
  var fs = require('fs');
  var url = require('url');
  var https = require('https');
  var querystring = require('querystring');

  var PORT = 8093;
  var APP_CONTROL_OPS = [
    'http://tizen.org/appcontrol/operation/view',
    'http://tizen.org/appcontrol/operation/default'
  ];

  var appsCache = null;

  function send(res, status, body, type) {
    res.writeHead(status, {
      'Content-Type': type || 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store'
    });
    res.end(body);
  }

  function listApps(cb) {
    try {
      tizen.application.getAppsInfo(function (infos) {
        var out = [];
        for (var i = 0; i < infos.length; i++) {
          var a = infos[i];
          if (a.show === false) continue;
          out.push({ id: a.id, name: a.name, iconPath: a.iconPath || '' });
        }
        appsCache = out;
        cb(null, out);
      }, function (e) {
        cb(e || new Error('getAppsInfo failed'));
      });
    } catch (e) {
      cb(e);
    }
  }

  // Try tizen.application.launch, then launchAppControl with each operation.
  function tryOne(id, cb) {
    var attempts = [];
    attempts.push(function (next) {
      tizen.application.launch(id, function () { cb(null); }, next);
    });
    APP_CONTROL_OPS.forEach(function (op) {
      attempts.push(function (next) {
        var ctl = new tizen.ApplicationControl(op, null, null, null, null);
        tizen.application.launchAppControl(ctl, id, function () { cb(null); }, next, null);
      });
    });
    var i = 0;
    function run(lastErr) {
      if (i >= attempts.length) return cb(lastErr || new Error('launch failed'));
      var fn = attempts[i++];
      try { fn(run); } catch (e) { run(e); }
    }
    run(null);
  }

  function launchFirst(ids, cb) {
    var i = 0;
    function next(lastErr) {
      if (i >= ids.length) return cb(lastErr || new Error('no ids'));
      var id = ids[i++];
      tryOne(id, function (err) {
        if (!err) return cb(null, id);
        next(err);
      });
    }
    next(null);
  }

  function serveIcon(res, id) {
    var app = null;
    var list = appsCache || [];
    for (var i = 0; i < list.length; i++) if (list[i].id === id) app = list[i];
    if (!app || !app.iconPath) return send(res, 404, '{"ok":false}');
    var p = app.iconPath.replace(/^file:\/\//, '');
    var ext = (p.split('.').pop() || '').toLowerCase();
    var type = ext === 'jpg' || ext === 'jpeg' ? 'image/jpeg' : 'image/png';
    fs.readFile(p, function (err, data) {
      if (err) return send(res, 404, '{"ok":false}');
      res.writeHead(200, { 'Content-Type': type, 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'max-age=86400' });
      res.end(data);
    });
  }

  // ---------- Calendars ----------

  function readBody(req, max, cb) {
    var chunks = [];
    var size = 0;
    req.on('data', function (c) {
      size += c.length;
      if (size > max) { req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', function () { cb(Buffer.concat(chunks).toString('utf8')); });
  }

  function fetchICS(link, redirects, cb) {
    var done = false;
    function finish(err, text) { if (!done) { done = true; cb(err, text); } }
    var req;
    try {
      req = https.get(link, function (r) {
        if (r.statusCode >= 300 && r.statusCode < 400 && r.headers.location && redirects > 0) {
          r.resume();
          var next = url.resolve(link, r.headers.location);
          if (!/^https:\/\//i.test(next)) return finish(new Error('redirect to non-https'));
          return fetchICS(next, redirects - 1, finish);
        }
        if (r.statusCode !== 200) { r.resume(); return finish(new Error('HTTP ' + r.statusCode)); }
        var chunks = [];
        var size = 0;
        r.on('data', function (c) {
          size += c.length;
          if (size > 20 * 1024 * 1024) { req.abort(); finish(new Error('calendar too large')); return; }
          chunks.push(c);
        });
        r.on('end', function () { finish(null, Buffer.concat(chunks).toString('utf8')); });
      });
    } catch (e) { return finish(e); }
    req.on('error', function (e) { finish(e); });
    req.setTimeout(25000, function () { req.abort(); finish(new Error('timeout')); });
  }

  var setup = null;     // { code, names, result, tries, timer }
  var lanServer = null;

  function lanIP() {
    try {
      var nets = require('os').networkInterfaces();
      var best = null;
      Object.keys(nets).forEach(function (k) {
        (nets[k] || []).forEach(function (n) {
          if (n.family !== 'IPv4' && n.family !== 4) return;
          if (n.internal || /^127\./.test(n.address) || /^169\.254\./.test(n.address)) return;
          if (!best || /^(192\.168|10\.|172\.)/.test(n.address)) best = n.address;
        });
      });
      return best;
    } catch (e) { return null; }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function page(body) {
    return '<!DOCTYPE html><html><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width, initial-scale=1">' +
      '<title>TV Dashboard calendars</title><style>' +
      'body{font-family:-apple-system,Helvetica,Arial,sans-serif;max-width:640px;margin:32px auto;padding:0 16px;color:#111;background:#fff}' +
      'h1{font-size:24px;font-weight:600}label{display:block;margin:14px 0 4px;font-size:14px;color:#444}' +
      'input[type=text],input[type=url]{width:100%;box-sizing:border-box;padding:10px;font-size:15px;border:1px solid #bbb;border-radius:8px}' +
      'fieldset{border:1px solid #ddd;border-radius:10px;margin:16px 0;padding:8px 14px 14px}' +
      'button{margin-top:18px;padding:12px 22px;font-size:16px;border:0;border-radius:8px;background:#111;color:#fff}' +
      'p.small{font-size:13px;color:#666}.err{color:#b00}' +
      '</style></head><body>' + body + '</body></html>';
  }

  function formPage(msg) {
    var names = (setup && setup.names) || [];
    var rows = '';
    for (var i = 1; i <= 3; i++) {
      var nm = names[i - 1] || '';
      rows += '<fieldset><label>Calendar ' + i + ' name (shown on the TV)</label>' +
        '<input type="text" name="name' + i + '" maxlength="30" value="' + esc(nm) + '" placeholder="e.g. Personal">' +
        '<label>Secret address in iCal format' + (nm ? ' (leave empty to keep the current one)' : '') + '</label>' +
        '<input type="url" name="url' + i + '" autocomplete="off" placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"></fieldset>';
    }
    return page('<h1>TV Dashboard calendars</h1>' + (msg ? '<p class="err">' + esc(msg) + '</p>' : '') +
      '<p class="small">In Google Calendar on a computer: Settings, then pick a calendar under ' +
      '"Settings for my calendars", then "Integrate calendar", then copy ' +
      '"Secret address in iCal format". These links are saved only on the TV.</p>' +
      '<form method="post" action="/save">' + rows +
      '<label><input type="checkbox" name="timesonly" value="1"> Show times only, not event titles</label>' +
      '<label><input type="checkbox" name="clear" value="1"> Remove all calendars from the TV</label>' +
      '<label>Code shown on the TV</label><input type="text" name="code" inputmode="numeric" maxlength="4" autocomplete="off">' +
      '<button type="submit">Save to TV</button></form>');
  }

  function stopSetup() {
    if (setup && setup.timer) clearTimeout(setup.timer);
    if (lanServer) { try { lanServer.close(); } catch (e) { /* already closed */ } }
    lanServer = null;
  }

  function startLan() {
    if (lanServer) return;
    lanServer = http.createServer(function (req, res) {
      var u = url.parse(req.url, true);
      function html(status, body) {
        res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
        res.end(body);
      }
      if (!setup || setup.result) return html(410, page('<h1>Setup is closed</h1><p>Open calendar setup on the TV again.</p>'));
      if (req.method === 'POST' && u.pathname === '/save') {
        readBody(req, 64 * 1024, function (body) {
          if (!setup || setup.result) return html(410, page('<h1>Setup is closed</h1>'));
          var f = querystring.parse(body);
          if (String(f.code || '') !== setup.code) {
            setup.tries++;
            if (setup.tries >= 5) { stopSetup(); setup = null; return html(403, page('<h1>Too many wrong codes</h1><p>Setup closed. Start it again on the TV.</p>')); }
            return html(403, formPage('That code doesn\u2019t match the one on the TV.'));
          }
          var cals = [];
          for (var i = 1; i <= 3; i++) {
            cals.push({ name: String(f['name' + i] || '').slice(0, 30), url: String(f['url' + i] || '').trim() });
          }
          setup.result = { cals: cals, timesOnly: !!f.timesonly, clear: !!f.clear };
          html(200, page('<h1>Saved</h1><p>Look at your TV. You can close this page.</p>'));
          setTimeout(function () { if (lanServer) { try { lanServer.close(); } catch (e) {} lanServer = null; } }, 500);
        });
        return;
      }
      html(200, formPage(''));
    });
    lanServer.on('error', function (e) { console.log('tv-dashboard setup page error: ' + e); lanServer = null; });
    lanServer.listen(8094, '0.0.0.0');
  }

  function calRoute(req, res, u) {
    if (u.pathname === '/ics' && req.method === 'POST') {
      readBody(req, 8192, function (link) {
        link = String(link).trim().replace(/^webcal:\/\//i, 'https://');
        if (!/^https:\/\/[^\s]+$/i.test(link)) return send(res, 400, 'bad link', 'text/plain');
        fetchICS(link, 3, function (err, text) {
          if (err) return send(res, 502, String(err.message || err), 'text/plain');
          send(res, 200, text, 'text/calendar; charset=utf-8');
        });
      });
      return true;
    }
    if (u.pathname === '/calsetup/start') {
      stopSetup();
      var names = [];
      try { names = JSON.parse(String(u.query.names || '[]')); } catch (e) { names = []; }
      setup = { code: String(u.query.code || '').replace(/\D/g, '').slice(0, 4), names: names, result: null, tries: 0 };
      if (setup.code.length !== 4) { setup = null; send(res, 400, '{"ok":false}'); return true; }
      setup.timer = setTimeout(function () { stopSetup(); setup = null; }, 10 * 60 * 1000);
      startLan();
      send(res, 200, JSON.stringify({ ok: true, ip: lanIP(), port: 8094 }));
      return true;
    }
    if (u.pathname === '/calsetup/result') {
      if (setup && setup.result) {
        var r = setup.result;
        stopSetup();
        setup = null;
        send(res, 200, JSON.stringify({ done: true, cfg: r }));
      } else {
        send(res, 200, JSON.stringify({ done: false, active: !!setup }));
      }
      return true;
    }
    if (u.pathname === '/calsetup/stop') {
      stopSetup();
      setup = null;
      send(res, 200, '{"ok":true}');
      return true;
    }
    return false;
  }

  var server = http.createServer(function (req, res) {
    var u = url.parse(req.url, true);
    if (calRoute(req, res, u)) return;
    if (u.pathname === '/apps') {
      listApps(function (err, apps) {
        if (err) return send(res, 500, JSON.stringify({ ok: false, error: String(err.message || err) }));
        send(res, 200, JSON.stringify(apps.map(function (a) {
          return { id: a.id, name: a.name, hasIcon: !!a.iconPath };
        })));
      });
    } else if (u.pathname === '/icon') {
      serveIcon(res, String(u.query.id || ''));
    } else if (u.pathname === '/launch') {
      var ids = String(u.query.ids || '').split(',').filter(function (s) { return s; });
      launchFirst(ids, function (err, id) {
        if (err) return send(res, 200, JSON.stringify({ ok: false, error: String(err.message || err.name || err) }));
        send(res, 200, JSON.stringify({ ok: true, id: id }));
      });
    } else {
      send(res, 200, '{"ok":true,"service":"tv-dashboard"}');
    }
  });

  // If TizenBrew starts this service again, the earlier copy already owns the port.
  server.on('error', function (e) {
    if (e && e.code === 'EADDRINUSE') return;
    console.log('tv-dashboard service error: ' + e);
  });

  server.listen(PORT, '127.0.0.1');
})();
