/* The order box on the pricing card: first unit free, $2 each after that,
   and volume pricing (~$1 hardware + $0.10) on every unit of an order over
   10,000.
   It does not take payment. It writes the order email, and we reply with an
   invoice. With JavaScript off the form still opens a mail with the count. */
(function () {
  'use strict';

  // Cents, so $1.10 x n stays exact.
  var PRICE = 200;
  var VOLUME_MIN = 10000;    // orders above this get the volume price
  var VOLUME_PRICE = 110;
  var MAX = 1000000;
  var TO = 'robotstop.contact@gmail.com';

  var form = document.getElementById('order');
  if (!form) return;
  var qty = document.getElementById('order-qty');
  var total = document.getElementById('order-total');
  var math = document.getElementById('order-math');
  var btn = document.getElementById('order-btn');

  var fmt = function (n) { return n.toLocaleString('en-US'); };
  var usd = function (c) {
    return '$' + (c % 100 ? (c / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                          : (c / 100).toLocaleString('en-US'));
  };

  var count = function () {
    var n = Math.floor(Number(qty.value));
    if (!isFinite(n) || n < 1) return 1;
    return Math.min(n, MAX);
  };

  var volume = function (n) { return n > VOLUME_MIN; };
  var cost = function (n) { return volume(n) ? n * VOLUME_PRICE : Math.max(0, n - 1) * PRICE; };
  var each = function (n) { return usd(volume(n) ? VOLUME_PRICE : PRICE); };

  var render = function () {
    var n = count();
    var c = cost(n);
    total.textContent = c === 0 ? 'Free' : usd(c);
    math.textContent = n === 1 ? '1 free unit'
      : volume(n) ? fmt(n) + ' × ' + each(n) + ' volume price'
      : '1 free + ' + fmt(n - 1) + ' × ' + each(n);
    btn.textContent = 'Order ' + fmt(n) + (n === 1 ? ' unit' : ' units');
  };

  qty.addEventListener('input', render);
  qty.addEventListener('blur', function () { qty.value = count(); render(); });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var n = count();
    var c = cost(n);
    var body = [
      'Quantity: ' + fmt(n),
      'Total: ' + (c === 0 ? 'free (first unit)'
        : volume(n) ? usd(c) + ' (volume price, ' + each(n) + ' each)'
        : usd(c) + ' (first unit free, then ' + each(n) + ' each)'),
      '',
      'Name:',
      'Company:',
      'Ship to:',
      'Robot / device it is going on:',
      '',
      'Send an invoice and a ship date; nothing is charged until I approve it.'
    ].join('\n');
    window.location.href = 'mailto:' + TO +
      '?subject=' + encodeURIComponent('RobotStop order: ' + fmt(n) + (n === 1 ? ' unit' : ' units')) +
      '&body=' + encodeURIComponent(body);
  });

  render();
})();
