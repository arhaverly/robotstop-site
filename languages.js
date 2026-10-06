/* Search a local reference inventory. Catalog membership never implies support. */
(function () {
  'use strict';
  var I18N = window.RobotStopI18n;
  var t = I18N ? I18N.t : function (s) { return s; };
  function format(template, values) {
    return t(template).replace(/\{(\w+)\}/g, function (_, key) { return values[key]; });
  }
  var catalog = window.ROBOTSTOP_CATALOG;
  var results = document.getElementById('catalog-results');
  if (!catalog || !results) return;
  var input = document.getElementById('language-search');
  var level = document.getElementById('language-level');
  var status = document.getElementById('catalog-status');
  var prev = document.getElementById('catalog-prev');
  var next = document.getElementById('catalog-next');
  var page = 0, size = 24, matches = catalog.records;
  function normalize(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  }
  var index = catalog.records.map(function (r) {
    return normalize([r.name, r.id, r.iso, r.parent, r.family].join(' '));
  });
  function render() {
    results.replaceChildren();
    var start = page * size;
    var end = Math.min(start + size, matches.length);
    status.textContent = matches.length ?
      format('{total} reference entries · showing {start}–{end}', { total: matches.length.toLocaleString('en-US'), start: start + 1, end: end }) :
      t('No entries found. Try another spelling or tell us about your variety using the link below.');
    matches.slice(start, end).forEach(function (record) {
      var item = document.createElement('li');
      var name = document.createElement('a');
      name.href = 'https://glottolog.org/resource/languoid/id/' + record.id;
      name.textContent = record.name;
      var detail = document.createElement('p');
      detail.textContent = t(record.level) + ' · ' + record.id + (record.iso ? ' · ' + record.iso : '') +
        (record.parent ? ' · ' + record.parent : '');
      item.append(name, detail);
      results.append(item);
    });
    prev.disabled = page === 0;
    next.disabled = end >= matches.length;
  }
  function filter() {
    var terms = normalize(input.value.trim()).split(/\s+/).filter(Boolean);
    matches = catalog.records.filter(function (r, i) {
      return (level.value === 'all' || r.level === level.value) &&
        terms.every(function (term) { return index[i].includes(term); });
    });
    page = 0;
    render();
  }
  input.addEventListener('input', filter);
  level.addEventListener('change', filter);
  prev.addEventListener('click', function () { if (page > 0) { page--; render(); } });
  next.addEventListener('click', function () { if ((page + 1) * size < matches.length) { page++; render(); } });
  document.getElementById('catalog-filters').hidden = false;
  document.getElementById('catalog-pagination').hidden = false;
  function labels() {
    ['Languages + dialects', 'Languages', 'Dialects'].forEach(function (label, i) { level.options[i].textContent = t(label); });
  }
  if (I18N) I18N.onChange(function () { labels(); render(); });
  labels();
  render();
})();
