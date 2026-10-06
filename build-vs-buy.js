/* build-vs-buy.html: the cost chart and the break-even calculator. One model
   for both, and for the static table: buying is $2 a unit after a free first
   one, or $1.10 a unit (~$1 hardware + $0.10) on orders over 10,000; building
   is your engineering plus the same ~$1 of hardware per unit.

   chartMarkup() is also run at build time by tools/render_bvb_chart.js, which
   writes its output into the page so the chart is there with JavaScript off. */
(function (root) {
  'use strict';

  // Cents, so $1.10 x n stays exact; dollars only at the edges.
  var PRICE = 200;
  var VOLUME_MIN = 10000;
  var VOLUME_PRICE = 110;
  var HARDWARE = 100;

  var W = 720, H = 400;
  var M = { t: 26, r: 118, b: 52, l: 58 };
  var PW = W - M.l - M.r, PH = H - M.t - M.b;
  var YMAX = 5;   // dollars per unit; building runs off the top below that

  var buyCost = function (n) {
    return (n > VOLUME_MIN ? n * VOLUME_PRICE : Math.max(0, n - 1) * PRICE) / 100;
  };
  var buildCost = function (n, e) { return e + n * HARDWARE / 100; };
  // The unit count past which building is always cheaper. Over 10,000 units:
  // 1.10n = e + n  =>  n = e / 0.10. If that lands at or under 10,000, the
  // crossing is in the $2 tier: 2(n - 1) = e + n  =>  n = e + 2.
  var breakEven = function (e) {
    var vol = Math.ceil(e * 100 / (VOLUME_PRICE - HARDWARE));
    return vol > VOLUME_MIN ? vol : Math.ceil((e + PRICE / 100) * 100 / (PRICE - HARDWARE));
  };

  var k = function (n) {
    if (n < 1000) return String(Math.round(n));
    if (n >= 1e6) return +(n / 1e6).toFixed(2) + 'M';
    return +(n / 1000).toFixed(1) + 'k';
  };
  var usd = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };
  var cents = function (n) { return n >= 10 ? usd(n) : '$' + n.toFixed(2); };
  var round = function (n) { return n < 2000 ? n : Math.round(n / 1000) * 1000; };

  // The chart is cost per unit against units shipped on a log axis, so the
  // $2 -> $1.10 step at 10,000 sits mid-chart and building's falling cost per
  // unit reads as a curve. x spans whole decades: from two below the earlier
  // of the step and the crossing, to one past the crossing.
  var scales = function (e) {
    var even = breakEven(e);
    var lo = Math.max(0, Math.floor(Math.log10(Math.min(even, VOLUME_MIN))) - 2);
    var hi = Math.max(lo + 3, Math.ceil(Math.log10(even) + 0.7));
    return {
      even: even, lo: lo, hi: hi, xMin: Math.pow(10, lo), xMax: Math.pow(10, hi),
      x: function (n) { return M.l + ((Math.log10(n) - lo) / (hi - lo)) * PW; },
      n: function (px) { return Math.pow(10, lo + ((px - M.l) / PW) * (hi - lo)); },
      y: function (v) { return M.t + PH - (Math.min(v, YMAX) / YMAX) * PH; }
    };
  };

  var chartMarkup = function (e) {
    var s = scales(e), x = s.x, y = s.y, out = [];
    var f = function (v) { return v.toFixed(1); };
    var t = function (cls, xx, yy, txt) { out.push('<text class="' + cls + '" x="' + f(xx) + '" y="' + f(yy) + '">' + txt + '</text>'); };
    var xe = x(s.even), xv = x(VOLUME_MIN), right = M.l + PW;
    var volHigh = s.even > VOLUME_MIN;       // the crossing is in the volume tier
    var buyAtEven = (volHigh ? VOLUME_PRICE : PRICE) / 100;

    // Who is cheaper, either side of the crossing.
    out.push('<rect class="cz cz-buy" x="' + M.l + '" y="' + M.t + '" width="' + f(xe - M.l) + '" height="' + PH + '"/>');
    if (xe - M.l > 170) t('cz-label cz-label-buy', M.l + 12, M.t + PH - 14, 'RobotStop is cheaper');
    if (right - xe > 90) {
      t('cz-label cz-label-end', right - 10, M.t + PH - 30, 'Building');
      t('cz-label cz-label-end', right - 10, M.t + PH - 14, 'is cheaper');
    }

    // Grid: a line per dollar, a line per decade.
    for (var d = 0; d <= YMAX; d++) {
      out.push('<line class="grid" x1="' + M.l + '" x2="' + right + '" y1="' + f(y(d)) + '" y2="' + f(y(d)) + '"/>');
      t('tick tick-y', M.l - 10, y(d) + 4, '$' + d);
    }
    for (var p = s.lo; p <= s.hi; p++) {
      var xp = x(Math.pow(10, p));
      if (p > s.lo && p < s.hi) out.push('<line class="grid" x1="' + f(xp) + '" x2="' + f(xp) + '" y1="' + M.t + '" y2="' + (M.t + PH) + '"/>');
      t('tick tick-x', xp, M.t + PH + 22, k(Math.pow(10, p)));
    }
    out.push('<line class="axis" x1="' + M.l + '" x2="' + right + '" y1="' + (M.t + PH) + '" y2="' + (M.t + PH) + '"/>');
    t('axis-title', M.l + PW / 2, H - 6, 'Units shipped of one device (log scale)');

    // The hardware floor both options sit on.
    out.push('<line class="floor" x1="' + M.l + '" x2="' + right + '" y1="' + f(y(1)) + '" y2="' + f(y(1)) + '"/>');

    // Building: engineering spread over every unit, plus the hardware dollar.
    // Starts where it comes down through the top of the chart.
    var n0 = e > 0 ? Math.max(s.xMin, e / (YMAX - HARDWARE / 100)) : s.xMin, pts = [];
    for (var i = 0; i <= 160; i++) {
      var n = Math.pow(10, Math.log10(n0) + (i / 160) * (s.hi - Math.log10(n0)));
      pts.push(f(x(n)) + ',' + f(y(buildCost(n, e) / n)));
    }
    out.push('<polyline class="ln ln-build" points="' + pts.join(' ') + '"/>');
    if (n0 > s.xMin * 1.5) {
      var x0 = x(n0);
      t('note note-build', x0 + 8, M.t + 14, 'Building: ' + cents(buildCost(s.xMin, e) / s.xMin) + ' a unit at ' + k(s.xMin) + (s.xMin === 1 ? ' unit' : ' units'));
    }

    // Buying: $2, then the volume price from 10,000 on. A step, drawn square.
    var bp = [[s.xMin, PRICE / 100]];
    if (VOLUME_MIN < s.xMax) bp.push([VOLUME_MIN, PRICE / 100], [VOLUME_MIN, VOLUME_PRICE / 100]);
    bp.push([s.xMax, (VOLUME_MIN < s.xMax ? VOLUME_PRICE : PRICE) / 100]);
    out.push('<polyline class="ln ln-buy" points="' + bp.map(function (q) { return f(x(q[0])) + ',' + f(y(q[1])); }).join(' ') + '"/>');
    t('buy-label', M.l + 10, y(PRICE / 100) - 10, '$2 a unit');
    if (VOLUME_MIN < s.xMax) {
      t('buy-label', xv + 10, y(VOLUME_PRICE / 100) - 12, '$1.10 a unit');
      t('step-label', xv - 8, y((PRICE + VOLUME_PRICE) / 200) + 4, 'Over 10,000 units:');
      t('step-value', xv - 8, y((PRICE + VOLUME_PRICE) / 200) + 20, 'volume price');
      out.push('<line class="step-tick" x1="' + f(xv - 4) + '" x2="' + f(xv - 4) + '" y1="' + f(y(PRICE / 100) + 6) + '" y2="' + f(y(VOLUME_PRICE / 100) - 6) + '"/>');
    }

    // End labels.
    var yb = y(buyCost(s.xMax) / s.xMax), yh = y(buildCost(s.xMax, e) / s.xMax);
    if (Math.abs(yb - yh) < 36) { var mid = (yb + yh) / 2, up = yb <= yh; yb = mid + (up ? -18 : 18); yh = mid + (up ? 18 : -18); }
    t('end-label', right + 10, yb - 2, 'Buy');
    t('end-value', right + 10, yb + 14, cents(buyCost(s.xMax) / s.xMax) + ' a unit');
    t('end-label', right + 10, yh - 2, 'Build');
    t('end-value', right + 10, yh + 14, cents(buildCost(s.xMax, e) / s.xMax) + ' a unit');

    // The crossing.
    var ye = y(buyAtEven);
    out.push('<line class="even-guide" x1="' + f(xe) + '" x2="' + f(xe) + '" y1="' + M.t + '" y2="' + (M.t + PH) + '"/>');
    out.push('<circle class="even-dot" cx="' + f(xe) + '" cy="' + f(ye) + '" r="5"/>');
    t('even-label', xe + 10, ye - 42, 'Break-even');
    t('even-value', xe + 10, ye - 26, '~' + round(s.even).toLocaleString('en-US') + ' units');

    // Crosshair, moved by the hover layer.
    out.push('<g class="xhair" id="chart-xhair" style="display:none"><line class="xhair-line" y1="' + M.t + '" y2="' + (M.t + PH) + '"/>' +
      '<circle class="xhair-dot xhair-buy" r="4.5"/><circle class="xhair-dot xhair-build" r="4.5"/></g>');
    out.push('<rect class="hit" id="chart-hit" x="' + M.l + '" y="' + M.t + '" width="' + PW + '" height="' + PH + '"/>');
    return out.join('');
  };

  var api = { chartMarkup: chartMarkup, breakEven: breakEven };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (typeof document === 'undefined') return;

  var $ = function (id) { return document.getElementById(id); };

  // --- chart -----------------------------------------------------------------

  var svg = $('chart-svg'), tip = $('chart-tip');
  var chartNre = 50000, hoverN = null;

  var drawChart = function (e) {
    if (!svg) return;
    chartNre = e;
    var keep = svg.querySelector('desc');
    svg.innerHTML = chartMarkup(e);
    if (keep) svg.insertBefore(keep, svg.firstChild);
    var lbl = $('chart-nre-label');
    if (lbl) lbl.textContent = usd(e);
    var hit = $('chart-hit');
    hit.addEventListener('pointermove', function (ev) {
      var r = svg.getBoundingClientRect();
      show(scales(chartNre).n((ev.clientX - r.left) * (W / r.width)));
    });
    hit.addEventListener('pointerleave', hide);
    if (hoverN !== null) show(hoverN);
  };

  var row = function (cls, value, name) {
    var d = document.createElement('div'); d.className = 'bvb-tip-row';
    var key = document.createElement('span'); key.className = 'bvb-tip-key ' + cls;
    var b = document.createElement('strong'); b.textContent = value;
    var t = document.createElement('span'); t.textContent = name;
    d.appendChild(key); d.appendChild(b); d.appendChild(t);
    return d;
  };

  // Two significant figures, so the readout lands on numbers people say.
  var snap = function (n) {
    var p = Math.pow(10, Math.floor(Math.log10(n)) - 1);
    return Math.round(n / p) * p;
  };

  var show = function (n) {
    var s = scales(chartNre);
    n = Math.min(s.xMax, Math.max(s.xMin, snap(n)));
    hoverN = n;
    var buy = buyCost(n), build = buildCost(n, chartNre);
    var g = $('chart-xhair'); g.style.display = '';
    var xx = s.x(n);
    var l = g.querySelector('.xhair-line'); l.setAttribute('x1', xx); l.setAttribute('x2', xx);
    var cb = g.querySelector('.xhair-buy'); cb.setAttribute('cx', xx); cb.setAttribute('cy', s.y(buy / n));
    var ch = g.querySelector('.xhair-build'); ch.setAttribute('cx', xx); ch.setAttribute('cy', s.y(build / n));

    tip.textContent = '';
    var h = document.createElement('p'); h.className = 'bvb-tip-head';
    h.textContent = n.toLocaleString('en-US') + ' units';
    tip.appendChild(h);
    tip.appendChild(row('bvb-tip-buy', cents(buy / n) + ' a unit', 'buy, ' + usd(buy) + ' total'));
    tip.appendChild(row('bvb-tip-build', cents(build / n) + ' a unit', 'build, ' + usd(build) + ' total'));
    var v = document.createElement('p'); v.className = 'bvb-tip-verdict';
    v.textContent = buy < build ? 'Buying saves ' + usd(build - buy)
      : buy > build ? 'Building saves ' + usd(buy - build) : 'Even';
    tip.appendChild(v);
    tip.hidden = false;
    var frac = xx / W;
    tip.style.left = (frac * 100) + '%';
    tip.classList.toggle('is-left', frac > 0.55);
  };

  var hide = function () {
    hoverN = null;
    var g = $('chart-xhair'); if (g) g.style.display = 'none';
    tip.hidden = true;
  };

  if (svg) {
    svg.addEventListener('keydown', function (ev) {
      var s = scales(chartNre), cur = hoverN === null ? s.even : hoverN;
      if (ev.key === 'ArrowRight') { show(cur * 1.26); ev.preventDefault(); }
      else if (ev.key === 'ArrowLeft') { show(cur / 1.26); ev.preventDefault(); }
      else if (ev.key === 'Escape') hide();
    });
    svg.addEventListener('focus', function () { if (hoverN === null) show(scales(chartNre).even); });
    svg.addEventListener('blur', hide);
    drawChart(chartNre);
  }

  // --- calculator --------------------------------------------------------------

  var calc = $('calc');
  if (!calc) return;
  var units = $('calc-units'), nre = $('calc-nre');

  var num = function (el, min) {
    var n = Math.floor(Number(el.value));
    return isFinite(n) && n >= min ? n : min;
  };

  var render = function () {
    var n = num(units, 1), e = num(nre, 0);
    var buy = buyCost(n), build = buildCost(n, e);
    $('calc-buy').textContent = usd(buy);
    $('calc-build').textContent = usd(build);
    $('calc-even').textContent = breakEven(e).toLocaleString('en-US') + ' units';

    var gap = Math.abs(build - buy), verdict = $('calc-verdict');
    if (gap <= 0.02 * build) {
      verdict.textContent = 'About even. Pick whichever you would rather maintain.';
    } else if (buy < build) {
      verdict.textContent = 'Buying is cheaper by ' + usd(gap) + '.';
    } else {
      verdict.textContent = 'Building it is cheaper by ' + usd(gap) + '. At this volume, we would build it too.';
    }
    if (e !== chartNre) drawChart(e);
  };

  units.addEventListener('input', render);
  nre.addEventListener('input', render);
  calc.hidden = false;
  render();
})(this);
