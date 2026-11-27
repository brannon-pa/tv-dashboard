/*
 * Minimal iCalendar (.ics) reader for the dashboard. Plain ES5.
 *
 * ICal.parse(text, fromMs, toMs) -> [{ start, end, allDay, title }] sorted by start,
 * for every event (or repeat of an event) that overlaps [fromMs, toMs].
 *
 * Handles: repeating events (DAILY / WEEKLY / MONTHLY / YEARLY with INTERVAL, COUNT,
 * UNTIL, BYDAY, BYMONTHDAY, BYMONTH), EXDATE, edited single repeats (RECURRENCE-ID),
 * cancelled events, all-day events and time zones (via the browser's Intl support;
 * if a zone is unknown, the TV's own time zone is used).
 */
(function () {
  'use strict';

  var DAY = 86400000;
  var WD = { SU: 0, MO: 1, TU: 2, WE: 3, TH: 4, FR: 5, SA: 6 };
  var MAX_PERIODS = 3000;

  // ---------- Time zones ----------

  var fmtCache = {};
  // Offset of time zone `tz` from UTC (ms) at instant `ms`, or null if unsupported.
  function tzOffset(tz, ms) {
    var f = fmtCache[tz];
    if (f === undefined) {
      try {
        f = new Intl.DateTimeFormat('en-US', {
          timeZone: tz, hour12: false, year: 'numeric', month: '2-digit', day: '2-digit',
          hour: '2-digit', minute: '2-digit', second: '2-digit'
        });
      } catch (e) { f = null; }
      fmtCache[tz] = f;
    }
    if (!f) return null;
    var m = /(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)/.exec(f.format(new Date(ms)));
    if (!m) return null;
    var asUTC = Date.UTC(+m[3], +m[1] - 1, +m[2], +m[4] % 24, +m[5], +m[6]);
    return asUTC - Math.floor(ms / 1000) * 1000;
  }

  // Wall-clock time -> ms. kind: 'utc', 'tz' (named zone) or 'local' (the TV's zone).
  function wallToMs(y, mo, d, h, mi, s, kind, tz) {
    if (kind === 'utc') return Date.UTC(y, mo, d, h, mi, s);
    if (kind === 'tz') {
      var guess = Date.UTC(y, mo, d, h, mi, s);
      var off = tzOffset(tz, guess);
      if (off !== null) {
        var ms = guess - off;
        var off2 = tzOffset(tz, ms);
        return (off2 === null || off2 === off) ? ms : guess - off2;
      }
    }
    return new Date(y, mo, d, h, mi, s).getTime();
  }

  // ---------- Values ----------

  function parseDT(params, val) {
    var m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})(Z)?)?$/.exec(val);
    if (!m) return null;
    var tzm = /TZID=("?)([^;:"]+)\1/.exec(params || '');
    return {
      y: +m[1], mo: +m[2] - 1, d: +m[3],
      h: +(m[4] || 0), mi: +(m[5] || 0), s: +(m[6] || 0),
      allDay: !m[4],
      kind: m[7] ? 'utc' : (m[4] && tzm ? 'tz' : 'local'),
      tz: tzm ? tzm[2] : ''
    };
  }

  function msOf(t) { return wallToMs(t.y, t.mo, t.d, t.h, t.mi, t.s, t.kind, t.tz); }

  function parseDuration(v) {
    var m = /^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/.exec(v || '');
    if (!m) return 0;
    var ms = ((+(m[2] || 0) * 7 + +(m[3] || 0)) * 24 * 3600 + +(m[4] || 0) * 3600 + +(m[5] || 0) * 60 + +(m[6] || 0)) * 1000;
    return m[1] === '-' ? -ms : ms;
  }

  function unescapeText(v) {
    return v.replace(/\\n/gi, ' ').replace(/\\([,;\\])/g, '$1');
  }

  function dayNum(y, mo, d) { return Math.floor(Date.UTC(y, mo, d) / DAY); }
  function fromDayNum(n) {
    var x = new Date(n * DAY);
    return { y: x.getUTCFullYear(), mo: x.getUTCMonth(), d: x.getUTCDate(), wd: x.getUTCDay() };
  }

  // ---------- Reading the file ----------

  function readEvents(text) {
    var lines = text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/);
    var events = [];
    var ev = null;
    var skip = 0; // inside VALARM etc.
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line === 'BEGIN:VEVENT') { ev = { exdates: [] }; skip = 0; continue; }
      if (!ev) continue;
      if (line === 'END:VEVENT') { events.push(ev); ev = null; continue; }
      if (line.indexOf('BEGIN:') === 0) { skip++; continue; }
      if (line.indexOf('END:') === 0) { skip = Math.max(0, skip - 1); continue; }
      if (skip) continue;
      var c = line.indexOf(':');
      if (c < 0) continue;
      var head = line.substring(0, c);
      var val = line.substring(c + 1);
      var sc = head.indexOf(';');
      var name = (sc < 0 ? head : head.substring(0, sc)).toUpperCase();
      var params = sc < 0 ? '' : head.substring(sc + 1);
      if (name === 'SUMMARY') ev.title = unescapeText(val);
      else if (name === 'UID') ev.uid = val;
      else if (name === 'STATUS') ev.status = val.toUpperCase();
      else if (name === 'DTSTART') ev.start = parseDT(params, val);
      else if (name === 'DTEND') ev.end = parseDT(params, val);
      else if (name === 'DURATION') ev.duration = parseDuration(val);
      else if (name === 'RRULE') ev.rrule = parseRule(val);
      else if (name === 'RECURRENCE-ID') ev.recurrenceId = parseDT(params, val);
      else if (name === 'EXDATE') {
        var parts = val.split(',');
        for (var p = 0; p < parts.length; p++) {
          var t = parseDT(params, parts[p]);
          if (t) ev.exdates.push(msOf(t));
        }
      }
    }
    return events;
  }

  function parseRule(v) {
    var r = {};
    var parts = v.split(';');
    for (var i = 0; i < parts.length; i++) {
      var kv = parts[i].split('=');
      if (kv.length === 2) r[kv[0].toUpperCase()] = kv[1].toUpperCase();
    }
    return r;
  }

  // ---------- Repeats ----------

  function monthDays(y, mo, byday, bymd, defDay) {
    var first = dayNum(y, mo, 1);
    var len = dayNum(y, mo + 1, 1) - first;
    var firstWd = fromDayNum(first).wd;
    var out = [];
    if (byday) {
      for (var i = 0; i < byday.length; i++) {
        var m = /^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/.exec(byday[i]);
        if (!m) continue;
        var list = [];
        for (var d = (WD[m[2]] - firstWd + 7) % 7; d < len; d += 7) list.push(first + d);
        if (m[1]) {
          var k = +m[1];
          var pick = k > 0 ? list[k - 1] : list[list.length + k];
          if (pick !== undefined) out.push(pick);
        } else {
          out = out.concat(list);
        }
      }
    } else {
      var days = bymd || [defDay];
      for (var j = 0; j < days.length; j++) {
        var dd = days[j] > 0 ? days[j] : len + days[j] + 1;
        if (dd >= 1 && dd <= len) out.push(first + dd - 1);
      }
    }
    return out.sort(function (a, b) { return a - b; });
  }

  // Calls emit(startMs, {y,mo,d}) for each repeat, in order, until past toMs.
  function expand(ev, dur, fromMs, toMs, emit) {
    var r = ev.rrule;
    var s = ev.start;
    var freq = r.FREQ;
    var interval = Math.max(1, parseInt(r.INTERVAL, 10) || 1);
    var count = r.COUNT ? parseInt(r.COUNT, 10) : 0;
    var until = Infinity;
    if (r.UNTIL) {
      var u = parseDT('', r.UNTIL);
      if (u) until = u.allDay ? msOf(u) + DAY - 1 : msOf(u);
    }
    var byday = r.BYDAY ? r.BYDAY.split(',') : null;
    var bymd = r.BYMONTHDAY ? r.BYMONTHDAY.split(',').map(Number) : null;
    var bymonth = r.BYMONTH ? r.BYMONTH.split(',').map(function (x) { return +x - 1; }) : null;
    var startDay = dayNum(s.y, s.mo, s.d);
    var fromDay = Math.floor((fromMs - Math.max(dur, 0)) / DAY) - 2;
    var lastDay = Math.floor(toMs / DAY) + 2;
    var n = 0;
    var stopped = false;

    function take(dn) {
      if (dn < startDay) return;
      var c = fromDayNum(dn);
      var ms = wallToMs(c.y, c.mo, c.d, s.h, s.mi, s.s, s.kind, s.tz);
      if (ms > until) { stopped = true; return; }
      n++;
      if (count && n > count) { stopped = true; return; }
      if (ms > toMs) { stopped = true; return; }
      emit(ms, c);
    }

    function filterWd(days) {
      if (!byday || freq === 'MONTHLY' || freq === 'YEARLY') return days;
      var ok = {};
      for (var i = 0; i < byday.length; i++) {
        var m = /(SU|MO|TU|WE|TH|FR|SA)$/.exec(byday[i]);
        if (m) ok[WD[m[1]]] = true;
      }
      return days.filter(function (dn) { return ok[fromDayNum(dn).wd]; });
    }

    var p, guard, days, k;
    if (freq === 'DAILY') {
      p = count ? 0 : Math.max(0, Math.floor((fromDay - startDay) / interval));
      for (guard = 0; !stopped && guard < MAX_PERIODS * 4; guard++, p++) {
        var dn = startDay + p * interval;
        if (dn > lastDay) break;
        days = filterWd([dn]);
        if (days.length) take(days[0]);
      }
    } else if (freq === 'WEEKLY') {
      var weekStart = startDay - fromDayNum(startDay).wd;
      var wds = [];
      if (byday) {
        for (k = 0; k < byday.length; k++) {
          var mm = /(SU|MO|TU|WE|TH|FR|SA)$/.exec(byday[k]);
          if (mm) wds.push(WD[mm[1]]);
        }
        wds.sort(function (a, b) { return a - b; });
      } else {
        wds = [fromDayNum(startDay).wd];
      }
      p = count ? 0 : Math.max(0, Math.floor((fromDay - weekStart) / (7 * interval)));
      for (guard = 0; !stopped && guard < MAX_PERIODS; guard++, p++) {
        var ws = weekStart + p * 7 * interval;
        if (ws > lastDay) break;
        for (k = 0; k < wds.length && !stopped; k++) take(ws + wds[k]);
      }
    } else if (freq === 'MONTHLY') {
      var m0 = s.y * 12 + s.mo;
      var fromMonth = fromDayNum(fromDay).y * 12 + fromDayNum(fromDay).mo;
      p = count ? 0 : Math.max(0, Math.floor((fromMonth - m0) / interval) - 1);
      for (guard = 0; !stopped && guard < MAX_PERIODS; guard++, p++) {
        var mi = m0 + p * interval;
        var y = Math.floor(mi / 12);
        var mo = mi % 12;
        if (dayNum(y, mo, 1) > lastDay) break;
        days = monthDays(y, mo, byday, bymd, s.d);
        for (k = 0; k < days.length && !stopped; k++) take(days[k]);
      }
    } else if (freq === 'YEARLY') {
      var fromYear = fromDayNum(fromDay).y;
      p = count ? 0 : Math.max(0, Math.floor((fromYear - s.y) / interval) - 1);
      var months = bymonth || [s.mo];
      for (guard = 0; !stopped && guard < MAX_PERIODS; guard++, p++) {
        var yr = s.y + p * interval;
        if (dayNum(yr, 0, 1) > lastDay) break;
        for (k = 0; k < months.length && !stopped; k++) {
          days = monthDays(yr, months[k], byday, bymd, s.d);
          for (var j = 0; j < days.length && !stopped; j++) take(days[j]);
        }
      }
    }
  }

  // ---------- Public ----------

  function parse(text, fromMs, toMs) {
    var events = readEvents(String(text || ''));
    var out = [];
    var overridden = {}; // uid -> { startMs: true } for edited single repeats
    var i, ev;

    for (i = 0; i < events.length; i++) {
      ev = events[i];
      if (ev.recurrenceId && ev.uid) {
        (overridden[ev.uid] = overridden[ev.uid] || {})[msOf(ev.recurrenceId)] = true;
      }
    }

    function add(startMs, startParts, ev, dur) {
      var endMs;
      if (ev.start.allDay) {
        var days = Math.max(1, Math.round(dur / DAY));
        endMs = new Date(startParts.y, startParts.mo, startParts.d + days).getTime();
      } else {
        endMs = startMs + Math.max(dur, 0);
      }
      if (endMs < fromMs || (endMs === fromMs && endMs !== startMs) || startMs > toMs) return;
      out.push({ start: startMs, end: endMs, allDay: !!ev.start.allDay, title: ev.title || '(No title)' });
    }

    for (i = 0; i < events.length; i++) {
      ev = events[i];
      if (!ev.start || ev.status === 'CANCELLED') continue;
      var startMs = msOf(ev.start);
      var dur;
      if (ev.end) dur = msOf(ev.end) - startMs;
      else if (ev.duration) dur = ev.duration;
      else dur = ev.start.allDay ? DAY : 0;

      if (ev.rrule && !ev.recurrenceId) {
        var skip = overridden[ev.uid] || {};
        var ex = {};
        for (var e = 0; e < ev.exdates.length; e++) ex[ev.exdates[e]] = true;
        (function (ev, dur, skip, ex) {
          expand(ev, dur, fromMs, toMs, function (ms, parts) {
            if (ex[ms] || skip[ms]) return;
            add(ms, parts, ev, dur);
          });
        })(ev, dur, skip, ex);
      } else {
        add(startMs, ev.start, ev, dur);
      }
    }

    out.sort(function (a, b) { return a.start - b.start || (b.allDay ? 1 : 0) - (a.allDay ? 1 : 0); });
    return out;
  }

  window.ICal = { parse: parse };
})();
