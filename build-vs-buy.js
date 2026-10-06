/* build-vs-buy.html: the cost chart and the break-even calculator. One model
   for both, and for the static table: buying is $2 a unit after a free first
   one; building is your engineering plus the same ~$1 of hardware per unit.

   chartMarkup() is also run at build time by tools/render_bvb_chart.js, which
   writes its output into the page so the chart is there with JavaScript off. */
(function (root) {
  'use strict';

  var PRICE = 2;
  var HARDWARE = 1;

  var W = 720, H = 380;
  var M = { t: 22, r: 128, b: 50, l: 70 };
  var PW = W - M.l - M.r, PH = H - M.t - M.b;

  var buyCost = function (n) { return Math.max(0, n - 1) * PRICE; };
  var buildCost = function (n, e) { return e + n * HARDWARE; };
  // 2(n - 1) = e + n  =>  n = e + 2
  var breakEven = function (e) { return Math.ceil((e + PRICE) / (PRICE - HARDWARE)); };

  // Smallest max >= v whose quarter is 1, 2, 2.5 or 5 x 10^n, so ticks are round.
  var nice = function (v) {
    var q = Math.max(v, 1) / 4, p = Math.pow(10, Math.floor(Math.log10(q)));
    var m = [1, 2, 2.5, 5, 10].filter(function (c) { return c * p >= q; })[0];
    return m * p * 4;
  };
  var k = function (n) {
    if (n === 0) return '0';
    if (n >= 1e6) return +(n / 1e6).toFixed(2) + 'M';
    return +(n / 1000).toFixed(1) + 'k';
  };
  var usd = function (n) { return '$' + Math.round(n).toLocaleString('en-US'); };

  // Domain for engineering cost e: x runs to twice the break-even point so the
  // crossing sits mid-chart and the "later, building wins" half is visible.
  var scales = function (e) {
    var even = breakEven(e);
    var xMax = nice(Math.round(even * 2 / 1000) * 1000);
    var yMax = nice(Math.max(buyCost(xMax), buildCost(xMax, e)));
    return {
      even: even, xMax: xMax, yMax: yMax,
      x: function (n) { return M.l + (n / xMax) * PW; },
      y: function (v) { return M.t + PH - (v / yMax) * PH; }
    };
  };

  var chartMarkup = function (e) {
    var s = scales(e), x = s.x, y = s.y, out = [];
    var xe = x(s.even), ye = y(buyCost(s.even));
    var f = function (v) { return v.toFixed(1); };

    // Regions: who is cheaper, either side of the crossing.
    out.push('<rect class="cz cz-buy" x="' + f(M.l) + '" y="' + M.t + '" width="' + f(xe - M.l) + '" height="' + PH + '"/>');
    if (xe - M.l > 170) out.push('<text class="cz-label cz-label-buy" x="' + f(M.l + 12) + '" y="' + (M.t + 22) + '">RobotStop is cheaper</text>');
    if (M.l + PW - xe > 170) out.push('<text class="cz-label cz-label-end" x="' + f(M.l + PW - 12) + '" y="' + (M.t + PH - 14) + '">Building it is cheaper</text>');

    // Grid and axes.
    for (var i = 0; i <= 4; i++) {
      var v = (s.yMax / 4) * i, yy = y(v);
      out.push('<line class="grid" x1="' + M.l + '" x2="' + (M.l + PW) + '" y1="' + f(yy) + '" y2="' + f(yy) + '"/>');
      out.push('<text class="tick tick-y" x="' + (M.l - 10) + '" y="' + f(yy + 4) + '">' + (v === 0 ? '$0' : '$' + k(v)) + '</text>');
    }
    for (var j = 0; j <= 4; j++) {
      var n = (s.xMax / 4) * j;
      out.push('<text class="tick tick-x" x="' + f(x(n)) + '" y="' + (M.t + PH + 22) + '">' + k(n) + '</text>');
    }
    out.push('<line class="axis" x1="' + M.l + '" x2="' + (M.l + PW) + '" y1="' + (M.t + PH) + '" y2="' + (M.t + PH) + '"/>');
    out.push('<text class="axis-title" x="' + (M.l + PW / 2) + '" y="' + (H - 6) + '">Units shipped of one device</text>');

    // Break-even guide.
    out.push('<line class="even-guide" x1="' + f(xe) + '" x2="' + f(xe) + '" y1="' + M.t + '" y2="' + (M.t + PH) + '"/>');

    // The two lines. In-house is dashed, so identity is not color alone.
    out.push('<line class="ln ln-build" x1="' + M.l + '" y1="' + f(y(buildCost(0, e))) + '" x2="' + (M.l + PW) + '" y2="' + f(y(buildCost(s.xMax, e))) + '"/>');
    out.push('<line class="ln ln-buy" x1="' + M.l + '" y1="' + f(y(0)) + '" x2="' + (M.l + PW) + '" y2="' + f(y(buyCost(s.xMax))) + '"/>');

    // Direct labels at the line ends.
    var yb = y(buyCost(s.xMax)), yh = y(buildCost(s.xMax, e));
    if (Math.abs(yb - yh) < 30) { var mid = (yb + yh) / 2; yb = mid - 15; yh = mid + 15; }
    var lx = M.l + PW + 10;
    out.push('<text class="end-label" x="' + lx + '" y="' + f(yb - 2) + '">Buy</text>');
    out.push('<text class="end-value" x="' + lx + '" y="' + f(yb + 14) + '">' + usd(buyCost(s.xMax)) + '</text>');
    out.push('<text class="end-label" x="' + lx + '" y="' + f(yh - 2) + '">Build</text>');
    out.push('<text class="end-value" x="' + lx + '" y="' + f(yh + 14) + '">' + usd(buildCost(s.xMax, e)) + '</text>');

    // The crossing.
    out.push('<circle class="even-dot" cx="' + f(xe) + '" cy="' + f(ye) + '" r="5"/>');
    out.push('<text class="even-label" x="' + f(xe + 10) + '" y="' + f(ye + 24) + '">Break-even</text>');
    out.push('<text class="even-value" x="' + f(xe + 10) + '" y="' + f(ye + 40) + '">~' + (s.even < 2000 ? s.even : Math.round(s.even / 1000) * 1000).toLocaleString('en-US') + ' units</text>');

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

  var svg = $('chart-svg'), tip = $('chart-tip'), plot = $('chart-plot');
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
      var px = (ev.clientX - r.left) * (W / r.width);
      show(((px - M.l) / PW) * scales(chartNre).xMax);
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

  var show = function (n) {
    var s = scales(chartNre);
    var step = s.xMax / 100;
    n = Math.min(s.xMax, Math.max(step, Math.round(n / step) * step));
    hoverN = n;
    var buy = buyCost(n), build = buildCost(n, chartNre);
    var g = $('chart-xhair'); g.style.display = '';
    var xx = s.x(n);
    var l = g.querySelector('.xhair-line'); l.setAttribute('x1', xx); l.setAttribute('x2', xx);
    var cb = g.querySelector('.xhair-buy'); cb.setAttribute('cx', xx); cb.setAttribute('cy', s.y(buy));
    var ch = g.querySelector('.xhair-build'); ch.setAttribute('cx', xx); ch.setAttribute('cy', s.y(build));

    tip.textContent = '';
    var h = document.createElement('p'); h.className = 'bvb-tip-head';
    h.textContent = n.toLocaleString('en-US') + ' units';
    tip.appendChild(h);
    tip.appendChild(row('bvb-tip-buy', usd(buy), 'buy'));
    tip.appendChild(row('bvb-tip-build', usd(build), 'build'));
    var v = document.createElement('p'); v.className = 'bvb-tip-verdict';
    v.textContent = buy < build ? 'Buying saves ' + usd(build - buy)
      : buy > build ? 'Building saves ' + usd(buy - build) : 'Even';
    tip.appendChild(v);
    tip.hidden = false;
    var frac = (xx / W);
    tip.style.left = (frac * 100) + '%';
    tip.classList.toggle('is-left', frac > 0.6);
  };

  var hide = function () {
    hoverN = null;
    var g = $('chart-xhair'); if (g) g.style.display = 'none';
    tip.hidden = true;
  };

  if (svg) {
    svg.addEventListener('keydown', function (ev) {
      var s = scales(chartNre), step = s.xMax / 20;
      var cur = hoverN === null ? s.even : hoverN;
      if (ev.key === 'ArrowRight') { show(cur + step); ev.preventDefault(); }
      else if (ev.key === 'ArrowLeft') { show(cur - step); ev.preventDefault(); }
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
    if (gap < Math.max(1000, 0.02 * build)) {
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
