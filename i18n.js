/* Page language: English in the markup, everything else from i18n/<lang>.js.
 *
 * The HTML stays the single source of truth and stays readable. Translations
 * are keyed by the English text itself (textContent, whitespace collapsed), so
 * there are no keys to keep in step: change a sentence in the HTML and, until
 * someone translates the new wording, that one element simply shows English.
 * tools/i18n_check.mjs lists exactly which strings are missing per language.
 *
 * A translation unit is any element with text of its own (a non-blank direct
 * text node); its whole innerHTML is swapped, so inline markup like <strong>
 * or a link belongs inside the translation. Elements that only wrap other
 * elements are descended into. <pre>, <code>, <script>, <style> and anything
 * marked translate="no" or data-i18n-dynamic are left alone; the dynamic ones
 * are written by their own scripts through RobotStopI18n.t().
 *
 * Choosing the language, in order: ?lang= in the URL, the visitor's earlier
 * pick, then the browser's language list. No geo-IP lookup: the browser's
 * language is the person's stated preference, it costs no third-party request,
 * and a site that promises "no cloud" should not phone one to pick a font.
 *
 * Loaded synchronously in <head> so the page can be hidden until translated
 * instead of flashing English first.
 */
(function () {
  'use strict';

  var LANGS = [
    { code: 'en', label: 'English' },
    { code: 'es', label: 'Español' },
    { code: 'zh-Hans', label: '简体中文' },
    { code: 'zh-Hant', label: '繁體中文' }
  ];
  var KEY = 'robotstop-lang';
  var SKIP = { PRE: 1, CODE: 1, SCRIPT: 1, STYLE: 1, NOSCRIPT: 1, SELECT: 1, OPTION: 1 };
  var ATTRS = ['aria-label', 'title', 'alt', 'placeholder'];

  var root = document.documentElement;
  var base = (function () {
    var s = document.currentScript && document.currentScript.src;
    return s ? s.replace(/[^/]*$/, '') : '';
  })();

  var dicts = { en: {} };
  var current = 'en';
  var units = null;      // [{ el, key, html }] recorded from the English markup
  var attrs = null;      // [{ el, name, key }]
  var links = null;      // [{ el, href }]
  var meta = null;       // { title, description }
  var listeners = [];

  function norm(s) { return String(s).replace(/\s+/g, ' ').trim(); }

  function supported(code) {
    for (var i = 0; i < LANGS.length; i++) {
      if (LANGS[i].code.toLowerCase() === String(code).toLowerCase()) return LANGS[i].code;
    }
    return null;
  }

  // Map one BCP 47 tag from the browser onto a page language, or null.
  function fromTag(tag) {
    var t = String(tag || '').toLowerCase();
    if (!t) return null;
    if (t === 'en' || t.indexOf('en-') === 0) return 'en';
    if (t === 'es' || t.indexOf('es-') === 0) return 'es';
    if (t === 'yue' || t.indexOf('yue-') === 0) return 'zh-Hant';
    if (t === 'zh' || t.indexOf('zh-') === 0) {
      if (/-hant\b/.test(t) || /-(tw|hk|mo)\b/.test(t)) return 'zh-Hant';
      if (/-hans\b/.test(t) || /-(cn|sg|my)\b/.test(t)) return 'zh-Hans';
      // Bare "zh": the time zone is the best local hint for which script.
      try {
        var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (/^Asia\/(Taipei|Hong_Kong|Macau)$/.test(tz)) return 'zh-Hant';
      } catch (e) {}
      return 'zh-Hans';
    }
    return null;
  }

  function stored() {
    try { return supported(localStorage.getItem(KEY)); } catch (e) { return null; }
  }

  function remember(code) {
    try { localStorage.setItem(KEY, code); } catch (e) {}
  }

  function choose() {
    var q = null;
    try { q = supported(new URLSearchParams(location.search).get('lang')); } catch (e) {}
    if (q) { remember(q); return q; }
    var s = stored();
    if (s) return s;
    var list = navigator.languages && navigator.languages.length
      ? navigator.languages : [navigator.language || navigator.userLanguage];
    for (var i = 0; i < list.length; i++) {
      var m = fromTag(list[i]);
      if (m) return m;
    }
    return 'en';
  }

  /* ---------- recording the English page ---------- */

  function ownText(el) {
    for (var n = el.firstChild; n; n = n.nextSibling) {
      if (n.nodeType === 3 && /\S/.test(n.nodeValue)) return true;
    }
    return false;
  }

  function walk(el) {
    if (SKIP[el.nodeName] || el.getAttribute('translate') === 'no' ||
        el.hasAttribute('data-i18n-dynamic')) return;
    for (var a = 0; a < ATTRS.length; a++) {
      var v = el.getAttribute(ATTRS[a]);
      if (v && /\S/.test(v)) attrs.push({ el: el, name: ATTRS[a], key: norm(v) });
    }
    if (el.nodeName === 'A') {
      var h = el.getAttribute('href') || '';
      if (/^[\w.-]+\.html(#.*)?$/.test(h)) links.push({ el: el, href: h });
    }
    if (ownText(el)) {
      units.push({ el: el, key: norm(el.textContent), html: el.innerHTML });
      // Attributes and links inside a unit still need their own pass.
      var inner = el.querySelectorAll('*');
      for (var i = 0; i < inner.length; i++) walkAttrsOnly(inner[i]);
      return;
    }
    for (var c = el.firstElementChild; c; c = c.nextElementSibling) walk(c);
  }

  function walkAttrsOnly(el) {
    for (var a = 0; a < ATTRS.length; a++) {
      var v = el.getAttribute(ATTRS[a]);
      if (v && /\S/.test(v)) attrs.push({ el: el, name: ATTRS[a], key: norm(v), inner: true });
    }
    if (el.nodeName === 'A') {
      var h = el.getAttribute('href') || '';
      if (/^[\w.-]+\.html(#.*)?$/.test(h)) links.push({ el: el, href: h, inner: true });
    }
  }

  function record() {
    if (units) return;
    units = []; attrs = []; links = [];
    walk(document.body);
    var d = document.querySelector('meta[name="description"]');
    meta = { title: document.title, description: d ? d.getAttribute('content') : null, descEl: d };
  }

  /* ---------- applying a language ---------- */

  function t(english, code) {
    var d = dicts[code || current] || {};
    var k = norm(english);
    return Object.prototype.hasOwnProperty.call(d, k) ? d[k] : english;
  }

  function withLang(href, code) {
    if (code === 'en') return href;
    var i = href.indexOf('#');
    var path = i < 0 ? href : href.slice(0, i), hash = i < 0 ? '' : href.slice(i);
    return path + '?lang=' + encodeURIComponent(code) + hash;
  }

  function apply(code) {
    record();
    var d = dicts[code] || {};
    var has = function (k) { return Object.prototype.hasOwnProperty.call(d, k); };
    var i;
    for (i = 0; i < units.length; i++) {
      var u = units[i];
      var html = code !== 'en' && has(u.key) ? d[u.key] : u.html;
      if (u.el.innerHTML !== html) u.el.innerHTML = html;
    }
    // innerHTML replaced the inner nodes, so re-find them for attributes/links.
    for (i = 0; i < attrs.length; i++) {
      var a = attrs[i];
      if (a.inner) continue;
      a.el.setAttribute(a.name, code !== 'en' && has(a.key) ? d[a.key] : a.key);
    }
    for (i = 0; i < units.length; i++) {
      var inner = units[i].el.querySelectorAll('*');
      for (var j = 0; j < inner.length; j++) {
        for (var n = 0; n < ATTRS.length; n++) {
          var v = inner[j].getAttribute(ATTRS[n]);
          if (v && /\S/.test(v) && code !== 'en' && has(norm(v))) inner[j].setAttribute(ATTRS[n], d[norm(v)]);
        }
        if (inner[j].nodeName === 'A') {
          var h = (inner[j].getAttribute('href') || '').replace(/\?lang=[^#]*/, '');
          if (/^[\w.-]+\.html(#.*)?$/.test(h)) inner[j].setAttribute('href', withLang(h, code));
        }
      }
    }
    for (i = 0; i < links.length; i++) {
      if (!links[i].inner) links[i].el.setAttribute('href', withLang(links[i].href, code));
    }
    document.title = code !== 'en' && has(norm(meta.title)) ? d[norm(meta.title)] : meta.title;
    if (meta.descEl && meta.description) {
      var dk = norm(meta.description);
      meta.descEl.setAttribute('content', code !== 'en' && has(dk) ? d[dk] : meta.description);
    }
    root.setAttribute('lang', code);
    current = code;
    var sel = document.getElementById('lang-select');
    if (sel && sel.value !== code) sel.value = code;
    for (i = 0; i < listeners.length; i++) {
      try { listeners[i](code); } catch (e) {}
    }
  }

  function load(code, done) {
    if (dicts[code]) { done(); return; }
    var s = document.createElement('script');
    s.src = base + 'i18n/' + code + '.js';
    s.onload = done;
    s.onerror = done;          // fall back to English rather than a blank page
    document.head.appendChild(s);
  }

  function reveal() { root.classList.remove('i18n-wait'); }

  function setLanguage(code, save) {
    code = supported(code) || 'en';
    if (save) remember(code);
    try {
      var url = new URL(location.href);
      if (code === 'en') url.searchParams.delete('lang');
      else url.searchParams.set('lang', code);
      history.replaceState(history.state, '', url.toString());
    } catch (e) {}
    cjkFont(code);
    load(code, function () { apply(code); });
  }

  /* ---------- the picker ---------- */

  function picker() {
    var slot = document.querySelector('[data-lang-picker]');
    if (!slot || document.getElementById('lang-select')) return;
    var wrap = document.createElement('label');
    wrap.className = 'lang';
    wrap.setAttribute('translate', 'no');
    wrap.innerHTML =
      '<svg class="lang-icon" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.3"/>' +
      '<path d="M1.5 8h13M8 1.5c-2.2 2-2.2 11 0 13M8 1.5c2.2 2 2.2 11 0 13" fill="none" stroke="currentColor" stroke-width="1.3"/></svg>';
    var sel = document.createElement('select');
    sel.id = 'lang-select';
    sel.className = 'lang-select';
    // Fixed, multilingual name so it reads correctly whatever the page is in.
    sel.setAttribute('aria-label', 'Language · Idioma · 语言 · 語言');
    for (var i = 0; i < LANGS.length; i++) {
      var o = document.createElement('option');
      o.value = LANGS[i].code;
      o.textContent = LANGS[i].label;
      o.lang = LANGS[i].code;
      sel.appendChild(o);
    }
    sel.value = current;
    sel.addEventListener('change', function () { setLanguage(sel.value, true); });
    wrap.appendChild(sel);
    slot.appendChild(wrap);
  }

  /* ---------- start ---------- */

  // Chinese faces from Google Fonts, sliced by unicode-range so only the
  // glyphs on the page download. Most systems already have a CJK font and the
  // stack in styles.css prefers it; this covers the ones that do not.
  var CJK = {
    'zh-Hans': 'Noto+Sans+SC:wght@400;500;600;700',
    'zh-Hant': 'Noto+Sans+TC:wght@400;500;600;700'
  };
  function cjkFont(code) {
    if (!CJK[code] || document.getElementById('font-' + code)) return;
    var l = document.createElement('link');
    l.id = 'font-' + code;
    l.rel = 'stylesheet';
    l.href = 'https://fonts.googleapis.com/css2?family=' + CJK[code] + '&display=swap';
    document.head.appendChild(l);
  }

  var initial = choose();
  root.setAttribute('lang', initial);
  cjkFont(initial);
  if (initial !== 'en') {
    root.classList.add('i18n-wait');
    setTimeout(reveal, 2500);            // never leave a page hidden
  }

  var ready = false, loaded = initial === 'en';
  function go() {
    if (!ready || !loaded) return;
    apply(initial);
    reveal();
  }
  if (initial !== 'en') load(initial, function () { loaded = true; go(); });

  function onReady() { ready = true; picker(); go(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', onReady);
  else onReady();

  window.RobotStopI18n = {
    add: function (code, dict) {
      var out = {};
      for (var k in dict) if (Object.prototype.hasOwnProperty.call(dict, k)) out[norm(k)] = dict[k];
      dicts[code] = out;
    },
    t: function (english) { return t(english); },
    lang: function () { return current; },
    set: function (code) { setLanguage(code, true); },
    onChange: function (fn) { listeners.push(fn); },
    // For tools/i18n_check.mjs: the English strings this page needs translated.
    catalog: function () {
      record();
      var out = [], seen = {};
      function push(k, html) {
        // Numerals, arrows and the like read the same in every language.
        if (k && !seen[k] && /[A-Za-z]/.test(k)) { seen[k] = 1; out.push({ key: k, html: html }); }
      }
      push(norm(meta.title), meta.title);
      if (meta.description) push(norm(meta.description), meta.description);
      units.forEach(function (u) { push(u.key, norm(u.html)); });
      attrs.forEach(function (a) { push(a.key, a.key); });
      // The globe writes these itself, from the chips' data attributes.
      [].forEach.call(document.querySelectorAll('[data-country]'), function (el) {
        push(norm(el.getAttribute('data-country')), el.getAttribute('data-country'));
      });
      return out;
    },
    languages: LANGS.slice()
  };
})();
