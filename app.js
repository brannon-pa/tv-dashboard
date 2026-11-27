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
  // "when": 'day' (bright), 'night' (dark) or 'any'. Daytime shows day + any; evening and night show night + any.
  var WALLPAPERS = [
    { file: '01-alpine-lake-eibsee.jpg',   when: 'any',   credit: 'Philipp / Unsplash' },
    { file: '02-alpine-lake-klontal.jpg',  when: 'day',   credit: 'Christopher Politano / Unsplash' },
    { file: '03-forest-misty-pines.jpg',   when: 'any',   credit: 'Dan Otis / Unsplash' },
    { file: '04-forest-evergreen-fog.jpg', when: 'day',   credit: 'Jacob Padilla / Unsplash' },
    { file: '05-coast-torrey-pines.jpg',   when: 'day',   credit: 'Lance Anderson / Unsplash' },
    { file: '06-coast-knysna.jpg',         when: 'day',   credit: 'De wet Cilliers / Unsplash' },
    { file: '07-desert-atacama-dunes.jpg', when: 'day',   credit: 'Marek Piwnicki / Unsplash' },
    { file: '08-aurora-lofoten.jpg',       when: 'night', credit: 'Matthieu Gouiffes / Unsplash' }
  ];
  var DAY_START = 7;   // 'day' wallpapers from 7 AM ...
  var DAY_END = 18;    // ... until 6 PM
  var WALL_INTERVAL_MS = 5 * 60 * 1000;

  // The TV's own app icons are old and low-res, so tiles show clean name labels.
  // Set to true to use the TV's icons instead (scaled to fit, never stretched).
  var USE_TV_ICONS = false;

  // Always-on behaviour.
  var IDLE_MS = 3 * 60 * 1000; // no button presses for this long -> ambient mode (dock hides)
  var NIGHT_START = 23;        // dim the screen from 11 PM ...
  var NIGHT_END = 6;           // ... until 6 AM
  var RELOAD_HOUR = 4;
  var WX_EFFECTS = true;
  var SHOW_JOKE = true;        // joke of the day under the date

  // Joke of the day: one per day from this list (changes at midnight, works offline).
  var JOKES = [
    ["Why did the scarecrow win an award?", "He was outstanding in his field."],
    ["What do you call a fake noodle?", "An impasta."],
    ["Why don't skeletons fight each other?", "They don't have the guts."],
    ["What do you call a bear with no teeth?", "A gummy bear."],
    ["Why did the bicycle fall over?", "It was two-tired."],
    ["What do you call cheese that isn't yours?", "Nacho cheese."],
    ["Why can't you trust stairs?", "They're always up to something."],
    ["How does a penguin build its house?", "Igloos it together."],
    ["Why did the math book look sad?", "It had too many problems."],
    ["What did the ocean say to the beach?", "Nothing, it just waved."],
    ["Why do cows wear bells?", "Because their horns don't work."],
    ["What do you call a sleeping bull?", "A bulldozer."],
    ["Why did the golfer bring two pairs of pants?", "In case he got a hole in one."],
    ["What do you call a dinosaur that crashes the car?", "Tyrannosaurus wrecks."],
    ["Why are elevator jokes so good?", "They work on many levels."],
    ["What does a cloud wear under its raincoat?", "Thunderwear."],
    ["Why did the cookie go to the doctor?", "It was feeling crummy."],
    ["What did one wall say to the other?", "I'll meet you at the corner."],
    ["Why don't eggs tell jokes?", "They'd crack each other up."],
    ["What do you call a fish with no eyes?", "A fsh."],
    ["How do you organize a space party?", "You planet."],
    ["Why did the tomato blush?", "It saw the salad dressing."],
    ["What's orange and sounds like a parrot?", "A carrot."],
    ["Why did the coffee file a police report?", "It got mugged."],
    ["What do you call a pig that does karate?", "A pork chop."],
    ["Why did the picture go to jail?", "It was framed."],
    ["What kind of tree fits in your hand?", "A palm tree."],
    ["Why do bees have sticky hair?", "They use honeycombs."],
    ["What did the grape do when it got stepped on?", "It let out a little wine."],
    ["Why was the broom late?", "It overswept."],
    ["What do you call a cow with no legs?", "Ground beef."],
    ["Why don't oysters share their pearls?", "They're shellfish."],
    ["What do you call an alligator in a vest?", "An investigator."],
    ["How do you make a tissue dance?", "Put a little boogie in it."],
    ["Why did the music teacher need a ladder?", "To reach the high notes."],
    ["What did the janitor say when he jumped out of the closet?", "Supplies!"],
    ["Why did the banana go to the doctor?", "It wasn't peeling well."],
    ["What do you call a lazy kangaroo?", "A pouch potato."],
    ["Why couldn't the leopard play hide and seek?", "He was always spotted."],
    ["What do lawyers wear to court?", "Lawsuits."],
    ["Why did the student eat his homework?", "The teacher said it was a piece of cake."],
    ["What do you call a snowman with a six-pack?", "An abdominal snowman."],
    ["Why did the computer go to the doctor?", "It had a virus."],
    ["What do you call a belt made of watches?", "A waist of time."],
    ["Why do seagulls fly over the sea?", "If they flew over the bay, they'd be bagels."],
    ["What did the zero say to the eight?", "Nice belt."],
    ["Why did the chicken join a band?", "It had the drumsticks."],
    ["What do you call a can opener that doesn't work?", "A can't opener."],
    ["How do mountains stay warm in winter?", "Snowcaps."],
    ["Why don't some couples go to the gym?", "Some relationships don't work out."],
    ["What's a skeleton's least favorite room?", "The living room."],
    ["Why did the frog take the bus to work?", "His car got toad."],
    ["What do you call a deer with no eyes?", "No idea."],
    ["How does the moon cut his hair?", "Eclipse it."],
    ["Why are ghosts bad liars?", "You can see right through them."],
    ["What did the left eye say to the right eye?", "Between you and me, something smells."],
    ["Why did the gym close down?", "It just didn't work out."],
    ["What do you call a factory that makes okay products?", "A satisfactory."],
    ["Why did the orange stop halfway up the hill?", "It ran out of juice."],
    ["What did the big flower say to the little flower?", "Hi, bud!"],
    ["Why do ducks have feathers?", "To cover their butt quacks."],
    ["What do you get when you cross a snowman and a vampire?", "Frostbite."],
    ["Why did the stadium get hot after the game?", "All the fans left."],
    ["What's brown and sticky?", "A stick."]
  ];       // light rain / snow / fog animation that matches the current weather         // reload once a day at 4 AM so a page left on for days stays fresh

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

  // Plain-text request (used for calendar files). body: null for GET.
  function getText(method, url, body, timeoutMs, cb) {
    var xhr = new XMLHttpRequest();
    var done = false;
    function finish(err, data) { if (!done) { done = true; cb(err, data); } }
    xhr.open(method, url, true);
    xhr.timeout = timeoutMs;
    xhr.onload = function () {
      if (xhr.status !== 200) return finish(new Error((xhr.responseText || ('HTTP ' + xhr.status)).slice(0, 120)));
      finish(null, xhr.responseText);
    };
    xhr.onerror = function () { finish(new Error('unreachable')); };
    xhr.ontimeout = function () { finish(new Error('timeout')); };
    if (body !== null) xhr.setRequestHeader('Content-Type', 'text/plain');
    xhr.send(body);
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

    // Drop finished events and roll "Tomorrow" into "Today".
    renderCal();
    renderJoke(d);

    // Switch to a fitting wallpaper when day turns to evening (or back).
    if (wallIdx >= 0 && !wallFits(wallIdx)) nextWall();

    // In ambient mode, drift the clock a little every few minutes.
    if (ambient && m % 3 === 0) drift();

    // Daily refresh (only if the page has been up for over an hour).
    if (h === RELOAD_HOUR && m === 0 && Date.now() - startedAt > 3600000) {
      window.location.reload();
      return;
    }

    setTimeout(tick, 60000 - d.getSeconds() * 1000 - d.getMilliseconds() + 50);
  }

  // ---------- Joke of the day ----------

  var jokeDay = -1;
  function renderJoke(d) {
    var box = $('joke');
    if (!box) return;
    if (!SHOW_JOKE || !JOKES.length) { box.className = 'hidden'; return; }
    var day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 86400000);
    if (day === jokeDay) return;
    jokeDay = day;
    var j = JOKES[day % JOKES.length];
    $('jokeQ').textContent = j[0];
    $('jokeA').textContent = j[1];
    box.className = '';
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

  function isDaytime() {
    var h = new Date().getHours();
    return h >= DAY_START && h < DAY_END;
  }

  function wallFits(i) {
    var when = WALLPAPERS[i].when || 'any';
    return when === 'any' || when === (isDaytime() ? 'day' : 'night');
  }

  function nextWall() {
    if (!WALLPAPERS.length) return;
    var n = WALLPAPERS.length;
    var next = (wallIdx + 1) % n;
    for (var k = 1; k <= n; k++) {
      var i = (wallIdx + k + n) % n;
      if (wallFits(i)) { next = i; break; }
    }
    showWall(next);
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
        toast('Couldn’t open ' + a.name + '. Open it from the home bar (press ↓ for diagnostics)');
      }
    });
  }

  // ---------- Diagnostics overlay (↓ on the dock, the Red button, or D on a keyboard) ----------

  var diagOpen = false;
  var svcStatus = '';

  function calDiagLines() {
    var lines = ['', 'Calendars:'];
    var tzTest = '';
    try {
      tzTest = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', hour12: false, year: 'numeric',
        month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date());
    } catch (e) { tzTest = 'not supported (' + e.message + ')'; }
    lines.push('  TV time: ' + new Date().toString());
    lines.push('  New York time via Intl: ' + tzTest);
    if (!calCfg || !calCfg.cals.length) lines.push('  none set up');
    else for (var c = 0; c < calCfg.cals.length; c++) lines.push('  ' + calCfg.cals[c].name + ': ' + (calStatus[c] || 'not fetched yet'));
    lines.push('  Saved events: ' + ((calLast && calLast.items) ? calLast.items.length + ', last updated ' + fmtTime(calLast.t) : 'none'));
    return lines;
  }

  function toggleDiag() {
    diagOpen = !diagOpen;
    $('diag').className = diagOpen ? '' : 'hidden';
    if (!diagOpen) return;
    $('diagStatus').textContent = 'Checking launcher service at ' + SERVICE + ' ...';
    $('diagList').textContent = calDiagLines().join('\n');
    getJSON('/apps', 5000, function (err, list) {
      if (!diagOpen) return;
      if (err) {
        $('diagStatus').textContent = 'Launcher service: NOT reachable (' + err.message + '). Mode: ' + mode +
          '. Restart the TV by holding the power button until the Samsung logo appears.';
        $('diagList').textContent = calDiagLines().join('\n');
        return;
      }
      goTV(list);
      $('diagStatus').textContent = 'Launcher service: OK. ' + list.length + ' apps installed. Mode: ' + mode;
      getJSON('/status', 3000, function (e2, st) {
        if (!diagOpen) return;
        if (!e2 && st && st.reopen) {
          var r = st.reopen;
          svcStatus = (r.appId ? 'on, reopens ' + r.appId : 'OFF (' + (r.error || 'TizenBrew not found') + ')') +
            '; wakes seen: ' + r.wakes + (r.lastWake ? ', last ' + r.lastWake : '') + (r.lastError ? '; last error: ' + r.lastError : '') +
            (st.lastCrash ? '. Service error caught: ' + st.lastCrash : '');
        } else {
          svcStatus = 'not available (restart the TV to load the new service)';
        }
        drawDiag(list);
      });
    });
  }

  function drawDiag(list) {
      var lines = ['Auto-reopen after standby: ' + svcStatus, ''];
      for (var i = 0; i < APPS.length; i++) {
        lines.push((APPS[i].found ? 'OK   ' : '--   ') + APPS[i].name + (APPS[i].found ? '  ->  ' + APPS[i].found.id : '  (not matched)'));
        if (!APPS[i].found) {
          var word = APPS[i].name.split(/[\s+]/)[0].toLowerCase();
          var near = list.filter(function (x) { return String(x.name).toLowerCase().indexOf(word) >= 0; })
                         .map(function (x) { return x.id + ' "' + x.name + '"'; });
          lines.push('       ' + (near.length ? 'similar: ' + near.slice(0, 3).join(', ') : 'no app with "' + word + '" in its name: probably not installed'));
        }
      }
      lines = lines.concat(calDiagLines());
      lines.push('', 'All installed apps:');
      for (var j = 0; j < list.length; j++) lines.push(list[j].id + '   ' + list[j].name);
      $('diagList').textContent = lines.join('\n');
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
    if (agendaOpen) { agendaKey(k); e.preventDefault(); return; }
    if (csOpen) {
      if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) closeCalSetup(true);
      e.preventDefault();
      return;
    }
    // Diagnostics: ↑, Back, OK or Red closes it.
    if (diagOpen) {
      if (k === KEY.UP || k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE || k === KEY.ENTER ||
          k === KEY.RED || k === 68) toggleDiag();
      e.preventDefault();
      return;
    }
    // ↓ on the dock opens diagnostics (for remotes without colour buttons).
    if (k === KEY.DOWN && area === 'dock') { toggleDiag(); e.preventDefault(); return; }
    // Areas from top to bottom: weather, calendar, dock.
    if (k === KEY.UP && !diagOpen) setArea(area === 'dock' ? 'cal' : 'weather');
    else if (k === KEY.DOWN && !diagOpen) setArea(area === 'weather' ? 'cal' : 'dock');
    else if (k === KEY.LEFT) { if (area === 'dock') setFocus(focus - 1); }
    else if (k === KEY.RIGHT) { if (area === 'dock') setFocus(focus + 1); }
    else if (k === KEY.ENTER) {
      if (diagOpen) return;
      if (area === 'weather') openPicker();
      else if (area === 'cal') { if (calCfg) openAgenda(); else openCalSetup(); }
      else launch(APPS[focus]);
    }
    else if ((k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) && area !== 'dock') setArea('dock');
    else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) goBack();
    else if (k === KEY.RED || k === 68 /* D */) toggleDiag();
    else if (k === KEY.GREEN || k === 87 /* W */) nextWall();
    else return;
    e.preventDefault();
  }

  // ---------- Weather (Open-Meteo: free, no account; location kept only on this TV) ----------

  var WX_REFRESH_MS = 30 * 60 * 1000;
  var WX_RETRY_MS = 5 * 60 * 1000;   // after a failed fetch
  var FORCE_NWS = /[?&]wx=nws/.test(window.location.search); // testing: index.html?wx=nws
  var WX_MAX_AGE_MS = 3 * 60 * 60 * 1000; // hide readings older than 3 hours
  var FORCE_FX = (/[?&]fx=(\w+)/.exec(window.location.search) || [])[1] || ''; // testing: index.html?fx=snow

  // Current conditions -> effect: '', 'drizzle', 'rain', 'heavy', 'thunder', 'snow' or 'fog'.
  function wxKind(w) {
    if (w.code !== undefined && w.code !== null) {
      var c = w.code;
      if (c >= 95) return 'thunder';
      if (c === 71 || c === 73 || c === 75 || c === 77 || c === 85 || c === 86) return 'snow';
      if (c === 65 || c === 82) return 'heavy';
      if (c === 61 || c === 63 || c === 66 || c === 67 || c === 80 || c === 81) return 'rain';
      if (c >= 51 && c <= 57) return 'drizzle';
      if (c === 45 || c === 48) return 'fog';
      return '';
    }
    var t = String(w.text || '').toLowerCase();
    if (/thunder|t-storm/.test(t)) return 'thunder';
    if (/snow|flurr|sleet|blizzard|wintry/.test(t)) return 'snow';
    if (/heavy rain|heavy shower/.test(t)) return 'heavy';
    if (/drizzle|sprinkle/.test(t)) return 'drizzle';
    if (/rain|shower/.test(t)) return 'rain';
    if (/fog|mist|haze/.test(t)) return 'fog';
    return '';
  }

  function setEffect(kind) {
    if (FORCE_FX) kind = FORCE_FX === 'none' ? '' : FORCE_FX;
    if (!WX_EFFECTS) kind = '';
    var cls = kind ? 'on ' + kind : '';
    var fx = $('wxfx');
    if (fx && fx.className !== cls) fx.className = cls;
  }
  var WX_TEXT = {
    0: 'Clear', 1: 'Mostly clear', 2: 'Partly cloudy', 3: 'Cloudy', 45: 'Fog', 48: 'Fog',
    51: 'Drizzle', 53: 'Drizzle', 55: 'Drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
    61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
    71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow', 80: 'Showers', 81: 'Showers',
    82: 'Heavy showers', 85: 'Snow showers', 86: 'Snow showers', 95: 'Thunderstorms',
    96: 'Thunderstorms', 99: 'Thunderstorms'
  };

  var area = 'dock';     // 'dock', 'cal' or 'weather'
  var wxLoc = null;      // { zip, name, lat, lon }
  var wxTimer = null;

  function loadJSON(key) {
    try { return JSON.parse(store(key) || 'null'); } catch (e) { return null; }
  }

  function setArea(a) {
    area = a;
    $('weather').classList.toggle('focus', a === 'weather');
    $('cal').classList.toggle('focus', a === 'cal');
    tiles[focus].classList.toggle('focus', a === 'dock');
    $('label').textContent = a === 'weather'
      ? (wxLoc ? 'Weather for ' + wxLoc.name + '. Press OK to change' : 'Press OK to set your ZIP code')
      : a === 'cal'
        ? (calCfg ? 'Calendar. Press OK to see every event' : 'Press OK to add calendars')
        : APPS[focus].name;
  }

  function renderWeather(w) {
    var fresh = w && (Date.now() - w.t) < WX_MAX_AGE_MS;
    setEffect(wxLoc && fresh ? wxKind(w) : '');
    if (!wxLoc) {
      $('wxTemp').textContent = '';
      $('wxDesc').textContent = 'Weather';
      $('wxRange').textContent = 'Select with ↑ and press OK';
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
    $('wxDesc').textContent = w.text || WX_TEXT[w.code] || '';
    var range = [];
    if (w.hi !== null && w.hi !== undefined) range.push('H ' + Math.round(w.hi) + '°');
    if (w.lo !== null && w.lo !== undefined) range.push('L ' + Math.round(w.lo) + '°');
    $('wxRange').textContent = range.join('  ');
  }

  function fetchWeather() {
    clearTimeout(wxTimer);
    wxTimer = setTimeout(fetchWeather, WX_REFRESH_MS);
    if (!wxLoc) { renderWeather(null); return; }
    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + wxLoc.lat + '&longitude=' + wxLoc.lon +
      '&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min' +
      '&temperature_unit=fahrenheit&timezone=auto&forecast_days=1';
    function done(w) {
      if (!w) {
        // Both sources failed: keep showing the last good reading, and retry sooner than usual.
        renderWeather(loadJSON('dash.wx.last'));
        clearTimeout(wxTimer);
        wxTimer = setTimeout(fetchWeather, WX_RETRY_MS);
        return;
      }
      store('dash.wx.last', JSON.stringify(w));
      renderWeather(w);
    }
    if (FORCE_NWS) { fetchNWS(done); return; }
    getURL(url, 15000, function (err, d) {
      if (err || !d || !d.current || !d.daily) { fetchNWS(done); return; } // backup source
      done({ t: Date.now(), temp: d.current.temperature_2m, text: WX_TEXT[d.current.weather_code] || '',
             hi: d.daily.temperature_2m_max[0], lo: d.daily.temperature_2m_min[0] });
    });
  }

  // Backup source: US National Weather Service (free, no account). The grid lookup is cached.
  function fetchNWS(cb) {
    var cached = loadJSON('dash.wx.nws');
    function withGrid(g) {
      getURL(g.hourly, 20000, function (err, h) {
        var now = !err && h && h.properties && h.properties.periods && h.properties.periods[0];
        if (!now) return cb(null);
        getURL(g.forecast, 20000, function (err2, f) {
          var ps = (!err2 && f && f.properties && f.properties.periods) || [];
          var hi = null, lo = null;
          for (var i = 0; i < ps.length && (hi === null || lo === null); i++) {
            if (ps[i].isDaytime && hi === null) hi = ps[i].temperature;
            if (!ps[i].isDaytime && lo === null) lo = ps[i].temperature;
          }
          cb({ t: Date.now(), temp: now.temperature, text: String(now.shortForecast || '').split(' then ')[0],
               hi: hi, lo: lo });
        });
      });
    }
    if (cached && cached.lat === wxLoc.lat && cached.lon === wxLoc.lon) { withGrid(cached); return; }
    getURL('https://api.weather.gov/points/' + wxLoc.lat + ',' + wxLoc.lon, 20000, function (err, d) {
      var p = !err && d && d.properties;
      if (!p || !p.forecast || !p.forecastHourly) return cb(null);
      var g = { lat: wxLoc.lat, lon: wxLoc.lon, forecast: p.forecast, hourly: p.forecastHourly };
      store('dash.wx.nws', JSON.stringify(g));
      withGrid(g);
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

  // ---------- Calendars (secret iCal links, kept only on this TV) ----------

  var CAL_REFRESH_MS = 15 * 60 * 1000;
  var CAL_RETRY_MS = 5 * 60 * 1000;
  var CAL_DAYS = 7;               // look this many days ahead
  var CAL_MAX_ROWS = 9;           // lines in the panel (day headings + events); OK shows the full agenda
  var CAL_COLORS = ['#5AC8FA', '#34C759', '#FF9F0A'];

  var calCfg = null;              // { cals: [{ name, url }], timesOnly }
  var calLast = null;             // { t, items: [{ s, e, a, title, c }] }
  var calStatus = [];             // per calendar, for diagnostics
  var calTimer = null;

  function startOfDay(ms) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); }

  function fmtTime(ms) {
    var d = new Date(ms);
    var h = d.getHours();
    var m = d.getMinutes();
    return (h % 12 || 12) + (m ? ':' + (m < 10 ? '0' : '') + m : '') + (h < 12 ? ' AM' : ' PM');
  }

  function dayLabel(dayMs, todayMs) {
    var diff = Math.round((dayMs - todayMs) / 86400000);
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return DAYS[new Date(dayMs).getDay()];
  }

  function el(tag, cls, text) {
    var x = document.createElement(tag);
    if (cls) x.className = cls;
    if (text !== undefined) x.textContent = text;
    return x;
  }

  // Upcoming events as display rows: { day: 'Today' } headings and { it, when } events.
  function calRows() {
    var now = Date.now();
    var today = startOfDay(now);
    var items = (calLast && calLast.items) || [];
    var rows = [];
    var lastDay = null;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (it.e <= now && !(it.e === it.s && it.s > now - 60000)) continue;
      var day = Math.max(startOfDay(it.s), today);
      if (day !== lastDay) {
        rows.push({ day: dayLabel(day, today), first: lastDay === null, today: day === today });
        lastDay = day;
      }
      var when = it.a ? 'All day' : (it.s <= now && it.e > now) ? 'Now' : (it.s < day ? 'Ongoing' : fmtTime(it.s));
      rows.push({ it: it, when: when, today: day === today });
    }
    return rows;
  }

  function rowEl(r) {
    if (r.day) return el('div', 'day' + (r.first ? ' first' : ''), r.day);
    var row = el('div', 'ev');
    var dot = el('span', 'dot');
    dot.style.backgroundColor = CAL_COLORS[r.it.c % CAL_COLORS.length];
    row.appendChild(dot);
    row.appendChild(el('span', 'when', r.when));
    var cal = calCfg.cals[r.it.c];
    row.appendChild(document.createTextNode(calCfg.timesOnly ? (cal ? cal.name : 'Busy') : r.it.title));
    return row;
  }

  function renderCal() {
    var box = $('calList');
    if (!box) return;
    box.innerHTML = '';
    if (!calCfg || !calCfg.cals.length) {
      box.appendChild(el('div', 'day first', 'Calendar'));
      box.appendChild(el('div', 'note', 'Select with ↑ and press OK to add calendars'));
      return;
    }
    var rows = calRows();
    var stale = calLast && Date.now() - calLast.t > 60 * 60 * 1000;
    var room = CAL_MAX_ROWS - (stale ? 1 : 0);
    var shown = rows.length > room ? room - 1 : rows.length;     // keep a line for "+N more"
    if (shown > 0 && rows[shown - 1].day) shown--;               // don't end on a lone heading
    for (var i = 0; i < shown; i++) box.appendChild(rowEl(rows[i]));
    if (shown < rows.length) {
      var moreToday = 0, moreLater = 0;
      for (var j = shown; j < rows.length; j++) if (!rows[j].day) { if (rows[j].today) moreToday++; else moreLater++; }
      box.appendChild(el('div', 'note', (moreToday ? '+' + moreToday + ' more today' : '+' + moreLater + ' more this week') +
        ' · select and press OK to see all'));
    }
    if (!rows.length) {
      box.appendChild(el('div', 'day first', 'Calendar'));
      box.appendChild(el('div', 'note', calLast ? 'Nothing in the next ' + CAL_DAYS + ' days' : 'Loading…'));
    }
    if (stale) box.appendChild(el('div', 'note', 'Last updated ' + fmtTime(calLast.t)));
    if (agendaOpen) renderAgenda();
  }

  // Full agenda overlay: every upcoming event, scroll with ↑ ↓.
  var agendaOpen = false;
  var agendaTop = 0;
  var AGENDA_ROWS = 15;

  function renderAgenda() {
    var rows = calRows();
    agendaTop = Math.max(0, Math.min(agendaTop, rows.length - AGENDA_ROWS));
    var box = $('agList');
    box.innerHTML = '';
    if (!rows.length) box.appendChild(el('div', 'note', 'Nothing in the next ' + CAL_DAYS + ' days'));
    var last = Math.min(rows.length, agendaTop + AGENDA_ROWS);
    if (last < rows.length && rows[last - 1].day) last--;          // don't end on a lone heading
    for (var i = agendaTop; i < last; i++) {
      var r = rows[i];
      if (r.day && i === agendaTop) r = { day: r.day, first: true };
      box.appendChild(rowEl(r));
    }
    var below = 0;
    for (var b = last; b < rows.length; b++) if (!rows[b].day) below++;
    $('agHint').textContent = (agendaTop > 0 ? '↑ more above · ' : '') + (below > 0 ? '↓ ' + below + ' more below · ' : '') +
      'OK to change calendars · Back to close';
  }

  function openAgenda() { agendaOpen = true; agendaTop = 0; $('agenda').className = ''; renderAgenda(); }
  function closeAgenda() { agendaOpen = false; $('agenda').className = 'hidden'; }

  function agendaKey(k) {
    if (k === KEY.UP) { agendaTop = Math.max(0, agendaTop - 3); renderAgenda(); }
    else if (k === KEY.DOWN) { agendaTop += 3; renderAgenda(); }
    else if (k === KEY.ENTER) { closeAgenda(); openCalSetup(); }
    else if (k === KEY.BACK || k === KEY.ESC || k === KEY.BACKSPACE) closeAgenda();
  }

  function fetchOne(link, cb) {
    if (mode === 'tv') return getText('POST', SERVICE + '/ics', link, 30000, cb);
    if (!/^https?:/i.test(link)) return getText('GET', link, null, 15000, cb); // desktop preview with a local test file
    cb(new Error('calendar links only load on the TV'));
  }

  function fetchCalendars() {
    clearTimeout(calTimer);
    if (!calCfg || !calCfg.cals.length) { renderCal(); return; }
    var from = startOfDay(Date.now());
    var to = from + CAL_DAYS * 86400000;
    var cals = calCfg.cals;
    var results = [];
    var pending = cals.length;
    var anyOk = false;
    cals.forEach(function (cal, idx) {
      fetchOne(cal.url, function (err, text) {
        var list = null;
        if (!err) {
          try { list = window.ICal.parse(text, from, to); } catch (e) { err = e; }
        }
        if (err) {
          calStatus[idx] = 'ERROR ' + (err.message || err) + ' (' + fmtTime(Date.now()) + ')';
          // Keep this calendar's previous events until it loads again.
          list = [];
          var old = (calLast && calLast.items) || [];
          for (var j = 0; j < old.length; j++) if (old[j].c === idx) list.push(old[j]);
          results[idx] = { old: list };
        } else {
          anyOk = true;
          var head = String(text).slice(0, 24).replace(/[\r\n]+/g, ' ');
          var total = (String(text).match(/BEGIN:VEVENT/g) || []).length;
          var td = new Date();
          var ymd = String(td.getFullYear()) + (td.getMonth() < 9 ? '0' : '') + (td.getMonth() + 1) + (td.getDate() < 10 ? '0' : '') + td.getDate();
          var st = window.ICal.stats(text, ymd);
          calStatus[idx] = 'OK, ' + list.length + ' events this week (' + fmtTime(Date.now()) + '); file ' +
            Math.round(String(text).length / 1024) + ' KB, ' + total + ' events in all (' + st.repeating + ' repeating), ' +
            st.fromToday + ' dated today or later, latest ' + (st.latest ? st.latest.substr(0, 4) + '-' + st.latest.substr(4, 2) + '-' + st.latest.substr(6, 2) : 'none') +
            ', starts "' + head + '"' + (/END:VCALENDAR\s*$/.test(String(text)) ? ', complete' : ', INCOMPLETE (download cut short)');
          results[idx] = { items: list };
        }
        if (--pending) return;
        var merged = [];
        for (var c = 0; c < results.length; c++) {
          var r = results[c];
          if (r.old) { merged = merged.concat(r.old); continue; }
          for (var k = 0; k < r.items.length; k++) {
            var x = r.items[k];
            merged.push({ s: x.start, e: x.end, a: x.allDay, title: x.title, c: c });
          }
        }
        merged.sort(function (a, b) { return a.s - b.s || (b.a ? 1 : 0) - (a.a ? 1 : 0); });
        if (anyOk) {
          calLast = { t: Date.now(), items: merged };
          store('dash.cal.last', JSON.stringify(calLast));
        }
        renderCal();
        calTimer = setTimeout(fetchCalendars, anyOk ? CAL_REFRESH_MS : CAL_RETRY_MS);
      });
    });
  }

  // Setup screen: the service shows a form on the TV's Wi-Fi address; we poll for the result.
  var csOpen = false;
  var csPoll = null;

  function csMsg(t) { $('csMsg').textContent = t; }

  function openCalSetup() {
    csOpen = true;
    $('calsetup').className = '';
    $('csAddr').textContent = '';
    $('csCode').textContent = '';
    if (mode !== 'tv') { csMsg('Calendar setup works on the TV only (the launcher service isn’t running here).'); return; }
    var code = String(1000 + Math.floor(Math.random() * 9000));
    var names = calCfg ? calCfg.cals.map(function (c) { return c.name; }) : [];
    csMsg('Starting…');
    getJSON('/calsetup/start?code=' + code + '&names=' + encodeURIComponent(JSON.stringify(names)), 5000, function (err, r) {
      if (!csOpen) return;
      if (err || !r || !r.ok) { csMsg('Couldn’t start setup. Restart the TV and try again.'); return; }
      $('csAddr').textContent = r.ip ? 'http://' + r.ip + ':' + r.port : 'http://<TV address>:' + r.port;
      $('csCode').textContent = code;
      csMsg(r.ip ? 'Waiting for the form… (closes by itself after 10 minutes)'
                 : 'Find the TV’s address in Settings → General → Network → Network Status → IP Settings.');
      pollCalSetup();
    });
  }

  function pollCalSetup() {
    clearTimeout(csPoll);
    csPoll = setTimeout(function () {
      if (!csOpen) return;
      getJSON('/calsetup/result', 4000, function (err, r) {
        if (!csOpen) return;
        if (!err && r && r.done) { applyCalSetup(r.cfg); return; }
        if (!err && r && r.active === false) { csMsg('Setup closed. Press Back, then OK to start again.'); return; }
        pollCalSetup();
      });
    }, 2000);
  }

  function closeCalSetup(cancel) {
    csOpen = false;
    clearTimeout(csPoll);
    $('calsetup').className = 'hidden';
    if (cancel && mode === 'tv') getJSON('/calsetup/stop', 3000, function () {});
    setArea('cal');
  }

  function applyCalSetup(f) {
    if (f.clear) {
      calCfg = null;
      calLast = null;
      store('dash.cal.cfg', '');
      store('dash.cal.last', '');
      closeCalSetup(false);
      renderCal();
      toast('Calendars removed from this TV');
      return;
    }
    var old = (calCfg && calCfg.cals) || [];
    var cals = [];
    for (var i = 0; i < 3; i++) {
      var row = (f.cals && f.cals[i]) || {};
      var link = String(row.url || '').replace(/^webcal:\/\//i, 'https://');
      if (!link && old[i]) link = old[i].url;              // empty = keep the current link
      if (!/^https:\/\//i.test(link)) continue;
      cals.push({ name: String(row.name || '') || (old[i] && old[i].name) || ('Calendar ' + (i + 1)), url: link });
    }
    calCfg = cals.length ? { cals: cals, timesOnly: !!f.timesOnly } : null;
    store('dash.cal.cfg', calCfg ? JSON.stringify(calCfg) : '');
    calLast = null;
    store('dash.cal.last', '');
    calStatus = [];
    closeCalSetup(false);
    renderCal();
    fetchCalendars();
    toast(cals.length ? 'Saved ' + cals.length + ' calendar' + (cals.length > 1 ? 's' : '') : 'No valid calendar links were entered');
  }

  // ---------- Start ----------

  function goTV(list) {
    if (mode === 'tv') return;
    mode = 'tv';
    applyInstalled(list);
    fetchCalendars();
  }

  // On the TV the service can take a while to start after a restart, so keep trying:
  // every 2 s for the first 2 minutes, then every 30 s. In a desktop browser, try once.
  function connect(onTV, attempt) {
    getJSON('/apps', 2500, function (err, list) {
      if (!err) { goTV(list); return; }
      if (attempt === 0) fetchCalendars();       // show cached events / errors meanwhile
      if (!onTV) return;
      setTimeout(function () { connect(onTV, attempt + 1); }, attempt < 60 ? 2000 : 30000);
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

    calCfg = loadJSON('dash.cal.cfg');
    calLast = loadJSON('dash.cal.last');
    renderCal();

    var w = parseInt(store('dash.wall'), 10);
    if (WALLPAPERS.length) {
      wallIdx = (w >= 0 ? w : -1);
      nextWall();
    }

    var onTV = !!window.tizen || /Tizen/i.test(navigator.userAgent);
    connect(onTV, 0);
  }

  start();
})();
