/* Two small enhancements, both optional: a nav that gains a border once you
   leave the hero, and a one-shot fade for sections as they arrive. */
(function () {
  'use strict';

  var nav = document.getElementById('nav');
  if (nav) {
    var onScroll = function () {
      nav.classList.toggle('is-stuck', window.scrollY > 24);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    // Hide the section links when they no longer fit on one row: the width
    // they need depends on the language, so measure instead of a breakpoint.
    var inner = nav.querySelector('.nav-inner');
    // In steps, until it fits: shrink the language picker to its icon, drop
    // the section links, then drop the page tag beside the logo.
    var fit = function () {
      if (!inner) return;
      var over = function () { return inner.scrollWidth > inner.clientWidth + 1; };
      var steps = ['nav-compact', 'nav-tight', 'nav-bare'];
      nav.classList.remove.apply(nav.classList, steps);
      for (var i = 0; i < steps.length && over(); i++) nav.classList.add(steps[i]);
    };
    fit();
    window.addEventListener('resize', fit);
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
    if (window.RobotStopI18n) window.RobotStopI18n.onChange(fit);
  }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) return;

  var seen = [];
  Array.prototype.forEach.call(
    document.querySelectorAll('.section > .shell > *'),
    function (el) {
      seen.push(el);
      el.classList.add('reveal');
    }
  );

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  seen.forEach(function (el, i) {
    el.style.transitionDelay = Math.min(i % 4, 3) * 60 + 'ms';
    io.observe(el);
  });
})();
