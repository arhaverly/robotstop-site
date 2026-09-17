/* Spinnable language globe.
 *
 * Canvas 2D, orthographic projection, no dependencies. The language list is not
 * in this file — it is read from the chip buttons in the markup, so the page
 * still lists every language with JavaScript off and there is only one copy of
 * the data. Land outlines come from globe-land.js (Natural Earth 110m).
 */
(function () {
  'use strict';

  var wrap = document.getElementById('globe');
  var canvas = document.getElementById('globe-canvas');
  if (!wrap || !canvas || !canvas.getContext) return;

  var chips = Array.prototype.slice.call(document.querySelectorAll('#globe-chips .chip'));
  if (!chips.length) return;

  var ctx = canvas.getContext('2d');
  var LAND = window.ROBOTSTOP_LAND || [];
  var DOTS = window.ROBOTSTOP_DOTS || [];
  var TAU = Math.PI * 2;
  var DEG = Math.PI / 180;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var LANGS = chips.map(function (el) {
    var d = el.getAttribute.bind(el);
    return {
      el: el,
      country: d('data-country'),
      language: d('data-language'),
      word: d('data-word'),
      roman: d('data-roman') || '',
      tier: d('data-tier'),
      tag: d('data-tag'),
      lat: parseFloat(d('data-lat')),
      lon: parseFloat(d('data-lon'))
    };
  });

  var out = {
    tier: document.getElementById('globe-tier'),
    country: document.getElementById('globe-country'),
    word: document.getElementById('globe-word'),
    language: document.getElementById('globe-language'),
    roman: document.getElementById('globe-roman')
  };
  var prevBtn = document.getElementById('globe-prev');
  var nextBtn = document.getElementById('globe-next');
  var tourBtn = document.getElementById('globe-tour');
  var hint = wrap.querySelector('.globe-hint');

  /* ---------- state ---------- */

  var START = 1;                                  // United States, reading "stop"
  var sel = START;
  var rot = -LANGS[START].lon;                    // degrees; view centre is lon -rot
  var tilt = LANGS[START].lat;                    // degrees; view centre is lat tilt
  var vel = 0;
  var dragging = false, moved = 0, lastX = 0, lastY = 0;
  var anim = null;
  var tour = !reduced;
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

  function markers() {
    var here = null;
    for (var i = 0; i < LANGS.length; i++) {
      var L = LANGS[i], p = project(L.lon, L.lat);
      if (p.z <= 0.02) continue;
      var on = i === sel;
      ctx.globalAlpha = Math.min(1, p.z * 2.4);
      if (on) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 13, 0, TAU);
        ctx.strokeStyle = 'rgba(240,67,56,.5)';
        ctx.lineWidth = 1.2;
        ctx.stroke();
        here = { p: p, L: L };
      }
      ctx.beginPath();
      ctx.arc(p.x, p.y, on ? 4.4 : 2.6, 0, TAU);
      ctx.fillStyle = on ? '#f04338' : 'rgba(240,67,56,.6)';
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (here) {
      ctx.font = '600 10px ui-monospace, SFMono-Regular, Menlo, monospace';
      ctx.textBaseline = 'middle';
      var label = here.L.country.toUpperCase();
      var right = here.p.x + 20 + ctx.measureText(label).width < W;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillStyle = 'rgba(255,255,255,.92)';
      ctx.fillText(label, here.p.x + (right ? 20 : -20), here.p.y);
    }
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
    for (var i = 0; i < LANGS.length; i++) {
      var d = angularDistance(LANGS[i].lon, LANGS[i].lat);
      if (d < bd) { bd = d; best = i; }
    }
    return best;
  }

  function show(i) {
    if (i === sel) return;
    sel = i;
    paint();
  }

  function paint() {
    var L = LANGS[sel];
    out.tier.textContent = L.tier === 'A' ? 'Tier A · qualified' : 'Tier B · beta';
    out.tier.className = 'globe-tier' + (L.tier === 'B' ? ' is-beta' : '');
    out.country.textContent = L.country;
    out.word.textContent = L.word;
    out.word.setAttribute('lang', L.tag);
    out.word.setAttribute('dir', L.tag === 'ar' ? 'rtl' : 'ltr');
    out.language.textContent = L.language;
    out.roman.textContent = L.roman ? '“' + L.roman + '”' : '';
    for (var i = 0; i < LANGS.length; i++) {
      LANGS[i].el.setAttribute('aria-pressed', i === sel ? 'true' : 'false');
    }
  }

  /* ---------- motion ---------- */

  function goTo(i, dur) {
    var L = LANGS[i];
    var targetRot = -L.lon;
    var d = ((targetRot - rot + 540) % 360) - 180;
    anim = {
      r0: rot, dr: d,
      t0: tilt, dt: clamp(L.lat, -58, 58) - tilt,
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
    tourBtn.textContent = 'Resume tour';
  }

  function startTour() {
    tour = true;
    tourBtn.setAttribute('aria-pressed', 'true');
    tourBtn.textContent = 'Pause tour';
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
      if (now - dwellFrom > 2000) goTo((sel + 1) % LANGS.length, 1200);
    }

    draw();
    if (dragging || anim || tour || Math.abs(vel) > 0.03) kick();
  }

  function kick() {
    if (raf === null && onScreen) raf = requestAnimationFrame(frame);
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
    tilt = clamp(tilt + dy * 0.26, -68, 68);
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
      for (var i = 0; i < LANGS.length; i++) {
        var p = project(LANGS[i].lon, LANGS[i].lat);
        if (p.z <= 0.02) continue;
        var d = Math.sqrt((p.x - px) * (p.x - px) + (p.y - py) * (p.y - py));
        if (d < hd) { hd = d; hit = i; }
      }
      if (hit >= 0) { goTo(hit, 600); return; }
    }
    kick();
  }

  canvas.addEventListener('pointerup', release);
  canvas.addEventListener('pointercancel', function () { dragging = false; kick(); });

  canvas.addEventListener('keydown', function (e) {
    var n = LANGS.length, k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowDown') { stopTour(); goTo((sel + 1) % n, 600); }
    else if (k === 'ArrowLeft' || k === 'ArrowUp') { stopTour(); goTo((sel - 1 + n) % n, 600); }
    else return;
    e.preventDefault();
    dismissHint();
  });

  prevBtn.addEventListener('click', function () {
    stopTour(); dismissHint(); goTo((sel - 1 + LANGS.length) % LANGS.length, 600);
  });
  nextBtn.addEventListener('click', function () {
    stopTour(); dismissHint(); goTo((sel + 1) % LANGS.length, 600);
  });
  tourBtn.addEventListener('click', function () {
    if (tour) stopTour(); else startTour();
  });

  chips.forEach(function (el, i) {
    el.addEventListener('click', function () {
      stopTour(); dismissHint(); goTo(i, 700);
    });
  });

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
  });

  if (reduced && tourBtn) {
    tourBtn.setAttribute('aria-pressed', 'false');
    tourBtn.textContent = 'Resume tour';
  }

  paint();
  resize();
  kick();
})();
