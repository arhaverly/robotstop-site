/* Check catalog inclusion; membership never implies detector support. */
(function () {
  'use strict';
  var I18N = window.RobotStopI18n;
  var t = I18N ? I18N.t : function (s) { return s; };
  function format(template, values) {
    return t(template).replace(/\{(\w+)\}/g, function (_, key) { return values[key]; });
  }
  var catalog = window.ROBOTSTOP_CATALOG;
  var form = document.getElementById('language-lookup');
  if (!catalog || !form) return;
  var input = document.getElementById('language-search');
  var status = document.getElementById('catalog-status');
  var lookup = new Map();
  var submitted = false;
  function normalize(text) {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
  }
  function add(name, record) {
    if (name && record && !lookup.has(normalize(name))) lookup.set(normalize(name), record);
  }
  function buildLookup() {
    lookup.clear();
    catalog.records.forEach(function (record) {
      add(record.name, record); add(record.iso, record); add(record.id, record);
    });
    var names;
    try { names = new Intl.DisplayNames([I18N ? I18N.lang() : 'en'], { type: 'language', fallback: 'none' }); }
    catch (_) { /* Source names and codes remain available. */ }
    catalog.records.forEach(function (record) {
      if (record.iso && names) {
        try { add(names.of(record.iso), record); } catch (_) { /* Retain source name. */ }
      }
    });
    add('Mandarin', lookup.get('cmn'));
  }
  function render() {
    status.hidden = !submitted;
    if (!submitted) { status.textContent = ''; return; }
    var query = normalize(input.value);
    if (!query) {
      status.textContent = t('Enter a language name or code to check inclusion.');
      return;
    }
    var record = lookup.get(query);
    status.textContent = record ?
      format('Included in the language catalog: {name}.', { name: record.name }) :
      t('Not found in the language catalog. Try another name or code.');
  }
  form.addEventListener('submit', function (event) {
    event.preventDefault(); submitted = true; render();
  });
  input.addEventListener('input', function () { submitted = false; render(); });
  if (I18N) I18N.onChange(function () { buildLookup(); render(); });
  buildLookup();
  form.hidden = false;
})();
