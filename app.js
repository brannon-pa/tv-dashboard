/* TV Dashboard: plain ES5 for the Tizen 4.0 browser. No frameworks, no build step. */
(function () {
  'use strict';

  // ---------- Config ----------

  // Port of our tiny launcher service (service.js), which runs inside TizenBrew.
  var SERVICE = 'http://127.0.0.1:8093';

  // Dock apps, in order. "match" finds the app by name in the TV's installed-app list;
  // "ids" are known Tizen app IDs, used if name matching finds nothing.
  var APPS = [
    { name: 'Netflix',     match: /netflix/i,                                ids: ['org.tizen.netflix-app', '3201907018807', '11101200001'], bg: '#000000', fg: '#E50914' },
    { name: 'YouTube',     match: /^youtube$|youtube(?!\s*(tv|kids|music))/i, ids: ['9Ur5IzDKqV.TizenYouTube', '111299001912'],                bg: '#FF0033', fg: '#FFFFFF' },
    { name: 'YouTube TV',  match: /youtube\s*tv/i,                           ids: ['PvWgqxV3Xa.YouTubeTV', '3201707014489'],                   bg: '#282828', fg: '#FF4E45' },
    { name: 'Prime Video', match: /prime\s*video|amazon/i,                   ids: ['evKhCgZelL.AmazonIgnitionLauncher2', 'org.tizen.ignition', '3201910019365', '3201512006785'], bg: '#0F171E', fg: '#1A98FF' },
    { name: 'Disney+',     match: /disney/i,                                 ids: ['MCmYXNxgcu.DisneyPlus', '3201901017640'],                  bg: '#0B1C4D', fg: '#FFFFFF' },
    { name: 'Max',         match: /^(hbo\s*)?max$|hbo\s*max/i,               ids: ['3202301029760', '3201601007230', 'cj37Ni3qXM.HBONow'],    bg: '#002BE7', fg: '#FFFFFF' },
    { name: 'Apple TV',    match: /apple\s*tv/i,                             ids: ['com.samsung.tv.aria-video', '3201807016597'],              bg: '#000000', fg: '#FFFFFF' },
    { name: 'Paramount+',  match: /paramount/i,                              ids: ['3202110025305', '3201710014981'],                          bg: '#0064FF', fg: '#FFFFFF' },
    { name: 'Peacock',     match: /peacock/i,                                ids: ['3202006020991'],                                           bg: '#000000', fg: '#FFFFFF' }
  ];

  // Rotating wallpapers (files in /wallpapers). Credits also listed in README.md.
  var WALLPAPERS = [
    { file: '01-alpine-lake-eibsee.jpg',   credit: 'Philipp / Unsplash' },
    { file: '02-alpine-lake-klontal.jpg',  credit: 'Christopher Politano / Unsplash' },
    { file: '03-forest-misty-pines.jpg',   credit: 'Dan Otis / Unsplash' },
    { file: '04-forest-evergreen-fog.jpg', credit: 'Jacob Padilla / Unsplash' },
    { file: '05-coast-torrey-pines.jpg',   credit: 'Lance Anderson / Unsplash' },
    { file: '06-coast-knysna.jpg',         credit: 'De wet Cilliers / Unsplash' },
    { file: '07-desert-atacama-dunes.jpg', credit: 'Marek Piwnicki / Unsplash' },
    { file: '08-aurora-lofoten.jpg',       credit: 'Matthieu Gouiffes / Unsplash' }
  ];
  var WALL_INTERVAL_MS = 5 * 60 * 1000;

  // The TV's own app icons are old and low-res, so tiles show clean name labels.
  // Set to true to use the TV's icons instead (scaled to fit, never stretched).
  var USE_TV_ICONS = false;

  // Always-on behaviour.
  var IDLE_MS = 3 * 60 * 1000; // no button presses for this long -> ambient mode (dock hides)
  var NIGHT_START = 23;        // dim the screen from 11 PM ...
  var NIGHT_END = 6;           // ... until 6 AM
  var RELOAD_HOUR = 4;         // reload once a day at 4 AM so a page left on for days stays fresh

  var KEY = { LEFT: 37, UP: 38, RIGHT: 39, DOWN: 40, ENTER: 13, BACK: 10009, ESC: 27, BACKSPACE: 8, RED: 403, GREEN: 404 };
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  // ---------- Helpers ----------

  function $(id) { return document.getElementById(id); }

  function store(key, val) {
    try {
      if (val === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, val);
    } catch (e) { /* storage unavailable: ignore */ }
    return null;
  }

  function getJSON(path, timeoutMs, cb) { getURL(SERVICE + path, timeoutMs, cb); }

  function getURL(url, timeoutMs, cb) {
    var xhr = new XMLHttpRequest();
    var done = false;
    function finish(err, data) { if (!done) { done = true; cb(err, data); } }
    xhr.open('GET', url, true);
    xhr.timeout = timeoutMs;
    xhr.onload = function () {
      if (xhr.status !== 200) return finish(new Error('HTTP ' + xhr.status));
      try { finish(null, JSON.parse(xhr.responseText)); } catch (e) { finish(e); }
    };
    xhr.onerror = function () { finish(new Error('service unreachable')); };
    xhr.ontimeout = function () { finish(new Error('service timeout')); };
    xhr.send();
  }

  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.className = 'show';
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.className = ''; }, 3200);
  }

  // ---------- Fit 1920x1080 stage to any window (desktop preview) ----------

  function fit() {
    var s = Math.min(window.innerWidth / 1920, window.innerHeight / 1080);
    var st = $('stage').style;
    var tf = s === 1 ? '' : 'scale(' + s + ')';
    st.webkitTransform = tf;
    st.transform = tf;
  }

  // ---------- Clock (redraws once a minute, aligned to the minute) ----------

  function tick() {
    var d = new Date();
    var h = d.getHours();
    var m = d.getMinutes();
    $('hm').textContent = (h % 12 || 12) + ':' + (m < 10 ? '0' : '') + m;
    $('ampm').textContent = h < 12 ? 'AM' : 'PM';
    $('date').textContent = DAYS[d.getDay()] + ', ' + MONTHS[d.getMonth()] + ' ' + d.getDate();

    // Night dimming.
    var night = NIGHT_START > NIGHT_END ? (h >= NIGHT_START || h < NIGHT_END) : (h >= NIGHT_START && h < NIGHT_END);
    document.body.classList.toggle('night', night);

    // In ambient mode, drift the clock a little every few minutes.
    if (ambient && m % 3 === 0) drift();

    // Daily refresh (only if the page has been up for over an hour).
    if (h === RELOAD_HOUR && m === 0 && Date.now() - startedAt > 3600000) {
      window.location.reload();
      return;
    }

    setTimeout(tick, 60000 - d.getSeconds() * 1000 - d.getMilliseconds() + 50);
  }

  // ---------- Ambient mode (dock hides after IDLE_MS; any button wakes it) ----------

  var ambient = false;
  var idleTimer = null;
  var startedAt = Date.now();

  function drift() {
    var dx = Math.round(Math.random() * 80 - 40);
    var dy = Math.round(Math.random() * 60 - 20);
    var tf = ambient ? 'translate(' + dx + 'px,' + dy + 'px)' : '';
    var st = $('clockbox').style;
    st.webkitTransform = tf;
    st.transform = tf;
  }

  function setAmbient(on) {
    ambient = on;
    document.body.classList.toggle('ambient', on);
    drift();
  }

  function poke() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(function () { setAmbient(true); }, IDLE_MS);
  }

  // ---------- Wallpapers (two layers, crossfade, preload only the next one) ----------

  var wallIdx = -1;
  var wallFront = 'wallA';
  var wallTimer = null;
  var firstWall = true;

  function showWall(i) {
    if (!WALLPAPERS.length) return;
    var w = WALLPAPERS[i];
    var img = new Image();
    img.onload = function () {
      var back = wallFront === 'wallA' ? 'wallB' : 'wallA';
      $(back).style.backgroundImage = 'url("' + img.src + '")';
      // First wallpaper appears instantly; later ones crossfade.
      $(back).className = firstWall ? 'wall on instant' : 'wall on';
      firstWall = false;
      $(wallFront).className = 'wall';
      wallFront = back;
      wallIdx = i;
      store('dash.wall', String(i));
      $('credit').textContent = w.credit ? 'Photo: ' + w.credit : '';
    };
    img.src = 'wallpapers/' + w.file;
  }

  function nextWall() {
    if (!WALLPAPERS.length) return;
    showWall((wallIdx + 1) % WALLPAPERS.length);
    clearInterval(wallTimer);
    wallTimer = setInterval(nextWall, WALL_INTERVAL_MS);
  }

  // ---------- Dock ----------

  var tiles = [];
  var focus = 0;
  var mode = 'preview'; // 'tv' once the launcher service answers

  function buildDock() {
    var dock = $('dock');
    for (var i = 0; i < APPS.length; i++) {
      var a = APPS[i];
      var el = document.createElement('div');
      el.className = 'tile';
      el.style.backgroundColor = a.bg;
      var nm = document.createElement('div');
      nm.className = 'name';
      nm.style.color = a.fg;
      nm.textContent = a.name;
      el.appendChild(nm);
      dock.appendChild(el);
      tiles.push(el);
    }
  }

  function setFocus(i) {
    if (i < 0 || i >= tiles.length) return;
    tiles[focus].className = tiles[focus].className.replace(' focus', '');
    focus = i;
    tiles[focus].className += ' focus';
    $('label').textContent = APPS[focus].name;
    store('dash.focus', String(focus));
  }

  // Match dock apps to what's installed on the TV.
  function applyInstalled(list) {
    for (var i = 0; i < APPS.length; i++) {
      var a = APPS[i];
      a.found = null;
      for (var j = 0; j < list.length; j++) {
        if (a.match.test(list[j].name)) { a.found = list[j]; break; }
      }
      // Fall back to a known ID if the TV reports it under a different name.
      if (!a.found) {
        for (var k = 0; k < list.length && !a.found; k++) {
          if (a.ids.indexOf(list[k].id) >= 0) a.found = list[k];
        }
      }
      if (a.found) {
        if (USE_TV_ICONS && a.found.hasIcon) addIcon(tiles[i], a.found.id);
      } else {
        tiles[i].className += ' missing';
      }
    }
  }

  function addIcon(tile, id) {
    var img = new Image();
    img.className = 'icon';
    img.onload = function () { tile.appendChild(img); };
    img.src = SERVICE + '/icon?id=' + encodeURIComponent(id);
  }

  function launch(a) {
    if (mode !== 'tv') { toast('Preview: would open ' + a.name); return; }
    var ids = a.found ? [a.found.id].concat(a.ids) : a.ids.slice();
    if (!a.found) toast(a.name + ' may not be installed. Trying anyway');
    getJSON('/launch?ids=' + encodeURIComponent(ids.join(',')), 8000, function (err, res) {
      if (err || !res || !res.ok) {
        toast('Couldn’t open ' + a.name + '. Open it from the home bar (Red = diagnostics)');
      }
    });
  }

  // ---------- Diagnostics overlay (Red button, or D on a keyboard) ----------

  var diagOpen = false;
  function toggleDiag() {
    diagOpen = !diagOpen;
    $('diag').className = diagOpen ? '' : 'hidden';
    if (!diagOpen) return;
    $('diagStatus').textContent = 'Checking launcher service at ' + SERVICE + ' ...';
    $('diagList').textContent = '';
    getJSON('/apps', 5000, function (err, list) {
      if (err) {
        $('diagStatus').textContent = 'Launcher service: NOT reachable (' + err.message + '). Mode: ' + mode;
        return;
      }
      $('diagStatus').textContent = 'Launcher service: OK. ' + list.length + ' apps installed. Mode: ' + mode;
      var lines = [];
      for (var i = 0; i < APPS.length; i++) {
        lines.push((APPS[i].found ? 'OK   ' : '--   ') + APPS[i].name + (APPS[i].found ? '  ->  ' + APPS[i].found.id : '  (not matched)'));
      }
      lines.push('', 'All installed apps:');
      for (var j = 0; j < list.length; j++) lines.push(list[j].id + '   ' + list[j].name);
      $('diagList').textContent = lines.join('\n');
    });
  }

  // ---------- Back / exit ----------

  function goBack() {
    if (diagOpen) { toggleDiag(); return; }
    // A normal Tizen app can exit itself. Inside TizenBrew this API is usually
    // missing, so fall back to returning to the TizenBrew screen.
    try {
      if (window.tizen && tizen.application) {
        tizen.application.getCurrentApplication().exit();
        return;
      }
    } catch (e) { /* not allowed here */ }
    if (window.history.length > 1) {
      window.history.back();
    } else {
      toast('Press the Home button to leave');
    }
  }

  // ---------- Keys ----------

  function onKey(e) {
    var k = e.keyCode;
    poke();
    // In ambient mode, the first press only brings the dock back.
    if (ambient) { setAmbient(false); e.preventDefault(); return; }
    if (pickerOpen) { pickerKey(k); e.preventDefault(); return; }
    if (k === KEY.UP && !diagOpen) setArea('weather');
    else if (k === KEY.DOWN && !diagOpen) setArea('dock');
    else if (k === KEY.LEFT) { if (area === 'dock') setFocus(focus - 1); }
    else if (k === KEY.RIGHT) { if (area === 'dock') setFocus(focus + 1); }
    else if (k === KEY.ENTER) {
      if (diagOpen) return;
      if (area === 'weather') openPicker(); else launch(APPS[focus]);
    }
    else if ((k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) && area === 'weather') setArea('dock');
    else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) goBack();
    else if (k === KEY.RED || k === 68 /* D */) toggleDiag();
    else if (k === KEY.GREEN || k === 87 /* W */) nextWall();
    else return;
    e.preventDefault();
  }

  // ---------- Weather (Open-Meteo: free, no account; location kept only on this TV) ----------

  var WX_REFRESH_MS = 30 * 60 * 1000;
  var WX_RETRY_MS = 5 * 60 * 1000;   // after a failed fetch
  var WX_MAX_AGE_MS = 3 * 60 * 60 * 1000; // hide readings older than 3 hours
  var WX_TEXT = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog',
    51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow', 80: 'Showers', 81: 'Showers',
    82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorms',
    96: 'Thunderstorms', 99: 'Thunderstorms'
  };

  var area = 'dock';     // 'dock' or 'weather'
  var wxLoc = null;      // { zip, name, lat, lon }
  var wxTimer = null;

  function loadJSON(key) {
    try { return JSON.parse(store(key) || 'null'); } catch (e) { return null; }
  }

  function setArea(a) {
    area = a;
    $('weather').classList.toggle('focus', a === 'weather');
    tiles[focus].classList.toggle('focus', a === 'dock');
    $('label').textContent = a === 'weather'
      ? (wxLoc ? 'Weather for ' + wxLoc.name + '. Press OK to change' : 'Press OK to set your ZIP code')
      : APPS[focus].name;
  }

  function renderWeather(w) {
    var fresh = w && (Date.now() - w.t) < WX_MAX_AGE_MS;
    if (!wxLoc) {
      $('wxTemp').textContent = '';
      $('wxDesc').textContent = 'Weather';
      $('wxRange').textContent = 'Press ↑ then OK to set up';
      $('weather').className = area === 'weather' ? 'setup focus' : 'setup';
      return;
    }
    $('weather').className = area === 'weather' ? 'focus' : '';
    if (!fresh) {
      $('wxTemp').textContent = '';
      $('wxDesc').textContent = wxLoc.name;
      $('wxRange').textContent = 'Weather unavailable';
      return;
    }
    $('wxTemp').textContent = Math.round(w.temp) + '°';
    $('wxDesc').textContent = WX_TEXT[w.code] || '';
    $('wxRange').textContent = 'H ' + Math.round(w.hi) + '°  L ' + Math.round(w.lo) + '°';
  }

  function fetchWeather() {
    clearTimeout(wxTimer);
    wxTimer = setTimeout(fetchWeather, WX_REFRESH_MS);
    if (!wxLoc) { renderWeather(null); return; }
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + wxLoc.lat + '&longitude=' + wxLoc.lon +
      '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min' +
      '&temperature_unit=fahrenheit&timezone=auto&forecast_days=1';
    getURL(url, 15000, function (err, d) {
      if (err || !d || !d.current || !d.daily) {
        // Keep showing the last good reading, and retry sooner than usual.
        renderWeather(loadJSON('dash.wx.last'));
        clearTimeout(wxTimer);
        wxTimer = setTimeout(fetchWeather, WX_RETRY_MS);
        return;
      }
      var w = { t: Date.now(), temp: d.current.temperature_2m, code: d.current.weather_code,
                hi: d.daily.temperature_2m_max[0], lo: d.daily.temperature_2m_min[0] };
      store('dash.wx.last', JSON.stringify(w));
      renderWeather(w);
    });
  }

  // ZIP picker: Left/Right choose a digit, Up/Down change it, OK looks it up, Back cancels.
  var pickerOpen = false;
  var pickDigits = [0, 0, 0, 0, 0];
  var pickPos = 0;

  function drawPicker(msg) {
    var html = '';
    for (var i = 0; i < 5; i++) {
      html += '<span class="digit' + (i === pickPos ? ' on' : '') + '">' + pickDigits[i] + '</span>';
    }
    $('pickDigits').innerHTML = html;
    if (msg !== undefined) $('pickMsg').textContent = msg;
  }

  function openPicker() {
    pickerOpen = true;
    var z = wxLoc ? wxLoc.zip : '00000';
    for (var i = 0; i < 5; i++) pickDigits[i] = parseInt(z.charAt(i), 10) || 0;
    pickPos = 0;
    $('picker').className = '';
    drawPicker('← → choose a digit · ↑ ↓ change it · OK to save · Back to cancel. Set 00000 to turn weather off.');
  }

  function closePicker() {
    pickerOpen = false;
    $('picker').className = 'hidden';
    setArea('weather');
  }

  function pickerKey(k) {
    if (k === KEY.LEFT) pickPos = (pickPos + 4) % 5;
    else if (k === KEY.RIGHT) pickPos = (pickPos + 1) % 5;
    else if (k === KEY.UP) pickDigits[pickPos] = (pickDigits[pickPos] + 1) % 10;
    else if (k === KEY.DOWN) pickDigits[pickPos] = (pickDigits[pickPos] + 9) % 10;
    else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) { closePicker(); return; }
    else if (k >= 48 && k <= 57) { pickDigits[pickPos] = k - 48; pickPos = Math.min(pickPos + 1, 4); }
    else if (k === KEY.ENTER) { saveZip(pickDigits.join('')); return; }
    drawPicker();
  }

  // ZIP -> { name, lat, lon }. Free ZIP databases miss some newer ZIPs, so:
  // 1) Open-Meteo, 2) Zippopotam, 3) nearby ZIPs with the same first 3 digits (same area).
  function zipFromOpenMeteo(zip, cb) {
    getURL('https://geocoding-api.open-meteo.com/v1/search?count=1&countryCode=US&format=json&name=' + zip, 10000,
      function (err, d) {
        var r = !err && d && d.results && d.results[0];
        cb(r ? { name: r.name + (r.admin1 ? ', ' + r.admin1 : ''), lat: r.latitude, lon: r.longitude } : null);
      });
  }

  function zipFromZippopotam(zip, cb) {
    getURL('https://api.zippopotam.us/us/' + zip, 10000, function (err, d) {
      var p = !err && d && d.places && d.places[0];
      cb(p ? { name: p['place name'] + ', ' + p.state, lat: parseFloat(p.latitude), lon: parseFloat(p.longitude) } : null);
    });
  }

  function pad5(n) { var s = String(n); while (s.length < 5) s = '0' + s; return s; }

  function lookupZip(zip, cb) {
    zipFromOpenMeteo(zip, function (r) {
      if (r) return cb(r);
      zipFromZippopotam(zip, function (r2) {
        if (r2) return cb(r2);
        // Try neighbours: +1, -1, +2, -2 ... within the same 3-digit area.
        var base = parseInt(zip, 10);
        var prefix = zip.substr(0, 3);
        var near = [];
        for (var d = 1; d <= 10; d++) {
          [base + d, base - d].forEach(function (n) {
            var z = pad5(n);
            if (n > 0 && z.substr(0, 3) === prefix) near.push(z);
          });
        }
        (function next(i) {
          if (i >= near.length) return cb(null);
          drawPicker('Looking up ' + zip + ' (checking nearby ZIP ' + near[i] + ') ...');
          zipFromZippopotam(near[i], function (r3) {
            if (r3) return cb(r3);
            next(i + 1);
          });
        })(0);
      });
    });
  }

  function saveZip(zip) {
    if (zip === '00000') {
      wxLoc = null;
      store('dash.wx.loc', '');
      store('dash.wx.last', '');
      closePicker();
      fetchWeather();
      toast('Weather turned off');
      return;
    }
    drawPicker('Looking up ' + zip + ' ...');
    lookupZip(zip, function (r) {
      if (!r) { drawPicker('Couldn’t find ZIP ' + zip + '. Check it and press OK again.'); return; }
      wxLoc = { zip: zip, name: r.name,
                lat: Math.round(r.lat * 100) / 100, lon: Math.round(r.lon * 100) / 100 };
      store('dash.wx.loc', JSON.stringify(wxLoc));
      store('dash.wx.last', '');
      closePicker();
      fetchWeather();
      toast('Weather set to ' + wxLoc.name);
    });
  }

  // ---------- Start ----------

  function connect(tries) {
    getJSON('/apps', 2500, function (err, list) {
      if (!err) {
        mode = 'tv';
        applyInstalled(list);
        return;
      }
      // On the TV the service may still be starting; retry a few times.
      if (tries > 0) setTimeout(function () { connect(tries - 1); }, 1500);
    });
  }

  function start() {
    fit();
    window.addEventListener('resize', fit);
    tick();
    buildDock();
    var f = parseInt(store('dash.focus'), 10);
    setFocus(f >= 0 && f < APPS.length ? f : 0);
    document.addEventListener('keydown', onKey);
    poke();

    wxLoc = loadJSON('dash.wx.loc');
    renderWeather(loadJSON('dash.wx.last'));
    fetchWeather();

    var w = parseInt(store('dash.wall'), 10);
    if (WALLPAPERS.length) {
      wallIdx = (w >= 0 ? w : -1);
      nextWall();
    }

    var onTV = !!window.tizen || /Tizen/i.test(navigator.userAgent);
    connect(onTV ? 6 : 0);
  }

  start();
})();
