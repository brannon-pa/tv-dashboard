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
 *
 * Written as ES5 for the older Node.js runtime on Tizen 4.0.
 */
(function () {
  'use strict';

  var http = require('http');
  var fs = require('fs');
  var url = require('url');

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

  var server = http.createServer(function (req, res) {
    var u = url.parse(req.url, true);
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
