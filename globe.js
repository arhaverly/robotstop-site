/* Country globe: one representative marker per country, with official and
 * other language designations kept separate. Data: country-languages.js.
 * Natural Earth coastlines and the full language catalog remain separate.
 */
(function () {
  'use strict';
  var I18N = window.RobotStopI18n;
  var t = I18N ? I18N.t : function (s) { return s; };
  function format(template, values) {
    return t(template).replace(/\{(\w+)\}/g, function (_, key) { return values[key]; });
  }

  var wrap = document.getElementById('globe');
  var canvas = document.getElementById('globe-canvas');
  if (!wrap || !canvas || !canvas.getContext) return;

  var catalog = window.ROBOTSTOP_COUNTRIES;
  if (!catalog || !catalog.records.length) return;
  var ctx = canvas.getContext('2d');
  if (!ctx) return;
  var LAND = window.ROBOTSTOP_LAND || [];
  var DOTS = window.ROBOTSTOP_DOTS || [];
  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var COUNTRIES = catalog.records;
  var byId = new Map();
  var mapped = [];
  var points = new Map();
  COUNTRIES.forEach(function (record, i) {
    byId.set(record.id, i);
    if (!hasLocation(record)) return;
    var lat = record.lat * DEG, lon = record.lon * DEG;
    var point = { index: i, x: Math.cos(lat) * Math.sin(lon),
      y: Math.sin(lat), z: Math.cos(lat) * Math.cos(lon) };
    mapped.push(point);
    points.set(i, point);
  });
  function hasLocation(record) {
    return Number.isFinite(record.lat) && Number.isFinite(record.lon) &&
      Math.abs(record.lat) <= 90 && Math.abs(record.lon) <= 180;
  }
  function count(number) { return number.toLocaleString('en-US'); }
  var mappedPosition = new Map(mapped.map(function (p, i) { return [p.index, i]; }));

  var out = {
    country: document.getElementById('globe-country'),
    languages: document.getElementById('globe-language-groups'),
    notes: document.getElementById('globe-notes'),
    regional: document.getElementById('globe-regional'),
    regionalList: document.getElementById('globe-regional-list'),
    position: document.getElementById('globe-position'),
    source: document.getElementById('globe-source')
  };
  var picker = document.getElementById('globe-country-select');
  var regionNames, languageNames;
  function readNames() {
    try {
      var locale = I18N ? I18N.lang() : 'en';
      regionNames = new Intl.DisplayNames([locale], { type: 'region', fallback: 'none' });
      languageNames = new Intl.DisplayNames([locale], { type: 'language', fallback: 'none' });
    } catch (_) { regionNames = null; languageNames = null; }
  }
  function countryName(country) {
    return (regionNames && regionNames.of(country.id)) || country.name;
  }
  function languageName(name) {
    var tag = catalog.languageTags[name];
    if (tag && languageNames) {
      try { return languageNames.of(tag) || t(name); } catch (_) { /* retain source name */ }
    }
    return t(name);
  }
  function populatePicker() {
    picker.replaceChildren();
    COUNTRIES.forEach(function (country) {
      var option = document.createElement('option');
      option.value = country.id;
      option.textContent = countryName(country);
      picker.appendChild(option);
    });
    picker.value = COUNTRIES[sel].id;
  }
  readNames();
  var prevBtn = document.getElementById('globe-prev');
  var nextBtn = document.getElementById('globe-next');
  var tourBtn = document.getElementById('globe-tour');
  var hint = wrap.querySelector('.globe-hint');

  /* ---------- state ---------- */

  var START = byId.has('US') ? byId.get('US') : 0;
  var sel = START;
  var rot = hasLocation(COUNTRIES[START]) ? -COUNTRIES[START].lon : 0;                    // degrees; view centre is lon -rot
  var tilt = hasLocation(COUNTRIES[START]) ? COUNTRIES[START].lat : 0;                    // degrees; view centre is lat tilt
  var vel = 0;
  var dragging = false, moved = 0, lastX = 0, lastY = 0;
  var anim = null;
  var tour = false; // Let the United States / English introduction remain readable.
  var dwellFrom = 0;
  var raf = null, onScreen = true;
  var W = 0, H = 0, R = 0, cx = 0, cy = 0;

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  /* ---------- projection ---------- */

  function project(lon, lat) {
    var l = (lon + rot) * DEG, p = lat * DEG;
    var cp = Math.cos(p);
    var x = cp * Math.sin(l), y = Math.sin(p), z = cp * Math.cos(l);
    var t = tilt * DEG, ct = Math.cos(t), st = Math.sin(t);
    return { x: cx + R * x, y: cy - R * (y * ct - z * st), z: y * st + z * ct };
  }

  /* ---------- drawing ---------- */

  function resize() {
    var rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = Math.round(rect.width);
    H = Math.round(rect.height);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    cx = W / 2; cy = H / 2;
    R = Math.min(W, H) / 2 - 8;
    draw();
  }

  function strokeArcs(points) {
    var open = false;
    ctx.beginPath();
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (p.z > 0) {
        if (open) ctx.lineTo(p.x, p.y);
        else { ctx.moveTo(p.x, p.y); open = true; }
      } else {
        open = false;
      }
    }
    ctx.stroke();
  }

  function graticule() {
    ctx.strokeStyle = 'rgba(255,255,255,.085)';
    ctx.lineWidth = 1;
    var lon, lat, pts;
    for (lon = -180; lon < 180; lon += 30) {
      pts = [];
      for (lat = -90; lat <= 90; lat += 3) pts.push(project(lon, lat));
      strokeArcs(pts);
    }
    for (lat = -60; lat <= 60; lat += 30) {
      pts = [];
      for (lon = -180; lon <= 180; lon += 3) pts.push(project(lon, lat));
      strokeArcs(pts);
    }
  }

  /* Land is drawn as an equal-area dot grid plus stroked coastlines. Filling the
     rings instead would need great-circle clipping at the limb: a ring with two
     visible fragments (Europe and Kamchatka, say) closes across the middle of
     the disc and paints a wedge over the ocean. */
  function landDots() {
    var k = clamp(R / 250, 0.7, 1.3);
    ctx.fillStyle = '#e9eef1';
    for (var i = 0; i < DOTS.length; i++) {
      var p = project(DOTS[i][0], DOTS[i][1]);
      if (p.z <= 0.02) continue;
      ctx.globalAlpha = 0.1 + 0.44 * p.z;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (1.05 + 0.8 * p.z) * k, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function coastlines() {
    ctx.strokeStyle = 'rgba(233,238,241,.26)';
    ctx.lineWidth = 0.8;
    for (var r = 0; r < LAND.length; r++) {
      var ring = LAND[r], pts = [];
      for (var i = 0; i < ring.length; i++) pts.push(project(ring[i][0], ring[i][1]));
      strokeArcs(pts);
    }
  }

  function markerProjection(point, cr, sr, ct, st) {
    var x = point.x * cr + point.z * sr;
    var z = point.z * cr - point.x * sr;
    return { x: cx + R * x, y: cy - R * (point.y * ct - z * st),
      z: point.y * st + z * ct };
  }

  function markers() {
    var cr = Math.cos(rot * DEG), sr = Math.sin(rot * DEG);
    var ct = Math.cos(tilt * DEG), st = Math.sin(tilt * DEG);
    ctx.fillStyle = 'rgba(255,101,85,.85)';
    ctx.beginPath();
    mapped.forEach(function (point) {
      var p = markerProjection(point, cr, sr, ct, st);
      if (p.z <= 0.02) return;
      ctx.moveTo(p.x + 2.8, p.y);
      ctx.arc(p.x, p.y, 2.8, 0, TAU);
    });
    ctx.fill();
    var selected = points.get(sel);
    if (!selected) return;
    var p = markerProjection(selected, cr, sr, ct, st);
    if (p.z <= 0.02) return;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 9, 0, TAU);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3.5, 0, TAU);
    ctx.fillStyle = '#fff';
    ctx.fill();
  }

  function reticle() {
    ctx.strokeStyle = 'rgba(240,67,56,.4)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, 19, 0, TAU);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx - 28, cy); ctx.lineTo(cx - 23, cy);
    ctx.moveTo(cx + 23, cy); ctx.lineTo(cx + 28, cy);
    ctx.moveTo(cx, cy - 28); ctx.lineTo(cx, cy - 23);
    ctx.moveTo(cx, cy + 23); ctx.lineTo(cx, cy + 28);
    ctx.stroke();
  }

  function draw() {
    if (!R) return;
    ctx.clearRect(0, 0, W, H);

    var g = ctx.createRadialGradient(cx - R * 0.42, cy - R * 0.5, R * 0.08, cx, cy, R * 1.12);
    g.addColorStop(0, '#242c33');
    g.addColorStop(0.55, '#141a1e');
    g.addColorStop(1, '#070a0b');
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.fillStyle = g;
    ctx.fill();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.clip();
    graticule();
    landDots();
    coastlines();
    markers();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, TAU);
    ctx.strokeStyle = 'rgba(255,255,255,.16)';
    ctx.lineWidth = 1;
    ctx.stroke();

    reticle();
  }

  /* ---------- selection ---------- */

  function angularDistance(lon, lat) {
    var a = lat * DEG, b = tilt * DEG, d = (lon + rot) * DEG;
    return Math.acos(clamp(Math.sin(a) * Math.sin(b) + Math.cos(a) * Math.cos(b) * Math.cos(d), -1, 1));
  }

  function nearest() {
    var best = sel, bd = Infinity;
    for (var i = 0; i < mapped.length; i++) {
      var index = mapped[i].index;
      var d = angularDistance(COUNTRIES[index].lon, COUNTRIES[index].lat);
      if (d < bd) { bd = d; best = index; }
    }
    return best;
  }

  function show(i) {
    if (i === sel) return;
    sel = i;
    paint();
  }

  function paint() {
    var country = COUNTRIES[sel];
    var name = countryName(country);
    out.country.textContent = name;
    out.languages.replaceChildren();
    var groups = [
      ['official', 'Official languages'], ['deFacto', 'De facto languages'],
      ['working', 'Working languages'], ['national', 'National languages']
    ];
    groups.forEach(function (group) {
      if (!country[group[0]].length) return;
      var section = document.createElement('div');
      var heading = document.createElement('h4');
      heading.textContent = t(group[1]);
      var list = document.createElement('ul');
      list.className = 'country-language-list';
      country[group[0]].forEach(function (language) {
        var item = document.createElement('li');
        item.textContent = languageName(language);
        list.appendChild(item);
      });
      section.append(heading, list);
      out.languages.appendChild(section);
    });
    out.notes.textContent = country.notes.map(t).join(' ');
    out.notes.hidden = !country.notes.length;
    out.regional.hidden = !country.regional.length;
    out.regional.open = false;
    out.regionalList.replaceChildren();
    country.regional.forEach(function (language) {
      var item = document.createElement('li');
      item.textContent = language;
      out.regionalList.appendChild(item);
    });
    out.position.textContent = format('Country {position} of {total}', { position: count(sel + 1), total: count(COUNTRIES.length) });
    out.source.href = country.sources[0];
    out.source.textContent = t('Country language source');
    picker.value = country.id;
    canvas.setAttribute('aria-label', format('Country globe. Selected: {name}. Languages: {languages}. Drag to spin, click a marker, or use arrow keys to browse {total} countries.', {
      name: name, languages: ['official', 'deFacto', 'working', 'national'].flatMap(function (key) { return country[key]; }).map(languageName).join(', '),
      total: count(COUNTRIES.length)
    }));
  }

  /* ---------- motion ---------- */

  function goTo(i, dur) {
    var L = COUNTRIES[i];
    vel = 0;
    if (!hasLocation(L)) {
      anim = null;
      show(i);
      dwellFrom = performance.now();
      kick();
      return;
    }
    var targetRot = -L.lon;
    var d = ((targetRot - rot + 540) % 360) - 180;
    anim = {
      r0: rot, dr: d,
      t0: tilt, dt: L.lat - tilt,
      start: null, dur: reduced ? 0 : (dur || 900)
    };
    show(i);
    kick();
  }

  function settle() {
    var i = nearest();
    show(i);
    goTo(i, 420);
  }

  function stopTour() {
    if (!tour) return;
    tour = false;
    tourBtn.setAttribute('aria-pressed', 'false');
    tourBtn.textContent = t('Start country tour');
  }

  function startTour() {
    if (!mapped.length) return;
    tour = true;
    tourBtn.setAttribute('aria-pressed', 'true');
    tourBtn.textContent = t('Pause tour');
    dwellFrom = 0;
    kick();
  }

  function frame(now) {
    raf = null;

    if (anim) {
      if (anim.start === null) anim.start = now;
      var k = anim.dur ? Math.min(1, (now - anim.start) / anim.dur) : 1;
      var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      rot = anim.r0 + anim.dr * e;
      tilt = anim.t0 + anim.dt * e;
      if (k >= 1) { anim = null; dwellFrom = now; }
    } else if (!dragging && Math.abs(vel) > 0.03) {
      rot += vel;
      vel *= 0.93;
      show(nearest());
      if (Math.abs(vel) <= 0.03) settle();
    } else if (tour && !dragging) {
      if (!dwellFrom) dwellFrom = now;
      if (now - dwellFrom > 2000) {
        var current = mappedPosition.has(sel) ? mappedPosition.get(sel) : -1;
        goTo(mapped[(current + 1) % mapped.length].index, 1200);
      }
    }

    draw();
    if (dragging || anim || tour || Math.abs(vel) > 0.03) kick();
  }

  function kick() {
    if (raf === null && onScreen && !document.hidden) raf = requestAnimationFrame(frame);
  }

  /* ---------- input ---------- */

  function dismissHint() {
    if (hint) hint.classList.add('is-gone');
  }

  canvas.addEventListener('pointerdown', function (e) {
    dragging = true;
    moved = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    vel = 0;
    anim = null;
    stopTour();
    dismissHint();
    try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* synthetic or stale pointer */ }
    kick();
  });

  canvas.addEventListener('pointermove', function (e) {
    if (!dragging) return;
    var dx = e.clientX - lastX, dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
    moved += Math.abs(dx) + Math.abs(dy);
    if (moved > 8) e.preventDefault();
    rot += dx * 0.32;
    tilt = clamp(tilt + dy * 0.26, -90, 90);
    vel = dx * 0.32;
    show(nearest());
    kick();
  });

  function release(e) {
    if (!dragging) return;
    dragging = false;
    if (moved < 8) {
      var rect = canvas.getBoundingClientRect();
      var px = e.clientX - rect.left, py = e.clientY - rect.top;
      var hit = -1, hd = 26;
      for (var i = 0; i < mapped.length; i++) {
        var index = mapped[i].index;
        var p = project(COUNTRIES[index].lon, COUNTRIES[index].lat);
        if (p.z <= 0.02) continue;
        var d = Math.sqrt((p.x - px) * (p.x - px) + (p.y - py) * (p.y - py));
        if (d < hd) { hd = d; hit = index; }
      }
      if (hit >= 0) { goTo(hit, 600); return; }
    }
    kick();
  }

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', function () { dragging = false; kick(); });

  canvas.addEventListener('keydown', function (e) {
    var n = COUNTRIES.length, k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown') { stopTour(); goTo((sel + 1) % n, 600); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { stopTour(); goTo((sel - 1 + n) % n, 600); }
    else return;
    e.preventDefault();
    dismissHint();
  });

  prevBtn.addEventListener('click', function () {
    stopTour(); dismissHint(); goTo((sel - 1 + COUNTRIES.length) % COUNTRIES.length, 600);
  });
  nextBtn.addEventListener('click', function () {
    stopTour(); dismissHint(); goTo((sel + 1) % COUNTRIES.length, 600);
  });
  tourBtn.addEventListener('click', function () {
    if (tour) stopTour(); else startTour();
  });

  picker.addEventListener('change', function () {
    if (!byId.has(picker.value)) return;
    stopTour(); dismissHint(); goTo(byId.get(picker.value), 700);
  });

  function coverage() {
    document.getElementById('globe-coverage').textContent = format('{total} countries · official languages by country', { total: count(COUNTRIES.length) });
  }
  coverage();
  populatePicker();
  picker.disabled = false;
  prevBtn.disabled = false;
  nextBtn.disabled = false;
  tourBtn.disabled = mapped.length === 0;

  /* ---------- lifecycle ---------- */

  if ('ResizeObserver' in window) {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener('resize', resize);
  }

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      if (onScreen) kick();
      else if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
    }, { threshold: 0.05 }).observe(wrap);
  }

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) kick();
    else if (raf !== null) { cancelAnimationFrame(raf); raf = null; }
  });

  if (!tour && tourBtn) {
    tourBtn.setAttribute('aria-pressed', 'false');
    tourBtn.textContent = t('Start country tour');
  }

  if (I18N) I18N.onChange(function () {
    readNames(); populatePicker(); paint(); coverage();
    tourBtn.textContent = t(tour ? 'Pause tour' : 'Start country tour');
  });
  paint();
  resize();
  kick();
})();
