/* The order box on the pricing card: first unit free, $2 each after that.
   It does not take payment. It writes the order email, and we reply with an
   invoice. With JavaScript off the form still opens a mail with the count. */
(function () {
  'use strict';

  var PRICE = 2;
  var MAX = 20000;
  var TO = 'robotstop.contact@gmail.com';

  var form = document.getElementById('order');
  if (!form) return;
  var qty = document.getElementById('order-qty');
  var total = document.getElementById('order-total');
  var math = document.getElementById('order-math');
  var btn = document.getElementById('order-btn');

  var fmt = function (n) { return n.toLocaleString('en-US'); };

  var count = function () {
    var n = Math.floor(Number(qty.value));
    if (!isFinite(n) || n < 1) return 1;
    return Math.min(n, MAX);
  };

  var cost = function (n) { return Math.max(0, n - 1) * PRICE; };

  var render = function () {
    var n = count();
    var c = cost(n);
    total.textContent = c === 0 ? 'Free' : '$' + fmt(c);
    math.textContent = n === 1
      ? '1 free unit'
      : '1 free + ' + fmt(n - 1) + ' × $' + PRICE;
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
      'Total: ' + (c === 0 ? 'free (first unit)' : '$' + fmt(c) + ' (first unit free, then $' + PRICE + ' each)'),
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
