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

  function getJSON(path, timeoutMs, cb) {
    var xhr = new XMLHttpRequest();
    var done = false;
    function finish(err, data) { if (!done) { done = true; cb(err, data); } }
    xhr.open('GET', SERVICE + path, true);
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
    setTimeout(tick, 60000 - d.getSeconds() * 1000 - d.getMilliseconds() + 50);
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
        if (a.found.hasIcon) addIcon(tiles[i], a.found.id);
      } else {
        tiles[i].className += ' missing';
      }
    }
  }

  function addIcon(tile, id) {
    var img = new Image();
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
    if (k === KEY.LEFT) setFocus(focus - 1);
    else if (k === KEY.RIGHT) setFocus(focus + 1);
    else if (k === KEY.ENTER) { if (!diagOpen) launch(APPS[focus]); }
    else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) goBack();
    else if (k === KEY.RED || k === 68 /* D */) toggleDiag();
    else if (k === KEY.GREEN || k === 87 /* W */) nextWall();
    else return;
    e.preventDefault();
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
