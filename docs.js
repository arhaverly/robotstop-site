/* Two conveniences for the developer guide: a copy button on every code block,
   and the table of contents tracking where you are. Both optional. */
(function () {
  'use strict';

  document.querySelectorAll('pre.code').forEach(function (pre) {
    var code = pre.querySelector('code');
    if (!code || !navigator.clipboard) return;

    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'copy';
    btn.textContent = 'Copy';
    btn.setAttribute('aria-label', 'Copy this to the clipboard');
    btn.addEventListener('click', function () {
      // innerText, not textContent: it drops the inline comment spans the way
      // a reader would, and keeps the line breaks.
      navigator.clipboard.writeText(code.innerText.replace(/\s+$/, '')).then(
        function () {
          btn.textContent = 'Copied';
          btn.classList.add('is-done');
          setTimeout(function () {
            btn.textContent = 'Copy';
            btn.classList.remove('is-done');
          }, 1600);
        },
        function () { btn.textContent = 'Press Cmd-C'; }
      );
    });
    pre.appendChild(btn);
  });

  var links = Array.prototype.slice.call(
    document.querySelectorAll('.docs-toc a[href^="#"]'));
  if (!links.length || !('IntersectionObserver' in window)) return;

  var byId = {};
  var sections = [];
  links.forEach(function (a) {
    var el = document.getElementById(a.getAttribute('href').slice(1));
    if (!el) return;
    byId[el.id] = a;
    sections.push(el);
  });

  var current = null;
  function mark(el) {
    if (current === el) return;
    current = el;
    links.forEach(function (a) { a.classList.remove('is-current'); });
    if (el && byId[el.id]) byId[el.id].classList.add('is-current');
  }

  // Track the topmost section that has passed under the header, rather than
  // whichever one happens to intersect -- otherwise short sections at the
  // bottom of the page never light up.
  var io = new IntersectionObserver(function () {
    var best = null;
    sections.forEach(function (el) {
      if (el.getBoundingClientRect().top <= 140) best = el;
    });
    mark(best || sections[0]);
  }, { rootMargin: '-120px 0px -70% 0px', threshold: [0, 0.1, 0.5, 1] });

  sections.forEach(function (el) { io.observe(el); });
  window.addEventListener('scroll', function () {
    var best = null;
    sections.forEach(function (el) {
      if (el.getBoundingClientRect().top <= 140) best = el;
    });
    mark(best || sections[0]);
  }, { passive: true });
})();
