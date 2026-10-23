(function () {
  var $ = function (s) { return document.querySelector(s); };
  var STEPS = [
    ['signed', 'Agreement signed', 'Your signed copy, pre-delivery guide and owner\'s manual were emailed to you.'],
    ['deposit_paid', 'Deposit received', 'Thank you. Your tub is ordered and on its way to us.'],
    ['delivery_scheduled', 'Delivery booked', 'We\'ll confirm the day with you. Make sure your base, power and access are ready.'],
    ['delivered', 'Delivered', 'Enjoy it. We\'ve registered your serial number for warranty.']
  ];
  var ORDER = ['signed', 'deposit_paid', 'delivery_scheduled', 'delivered'];
  function dl(label, v) { return v ? '<div><dt>' + label + '</dt><dd>' + NG.esc(v) + '</dd></div>' : ''; }

  function render(me, sales) {
    var first = (me.profile.full_name || '').split(' ')[0];
    $('#portalHello').textContent = first ? 'Welcome, ' + first : 'Welcome';
    if (!sales.length) {
      $('#portalBody').innerHTML = '<div class="card"><h2>Nothing here yet</h2><p>Once your agreement is signed, your tub will show up here. Questions? Call or text Blaine at (613) 292-1786.</p></div>';
      return;
    }
    $('#portalBody').innerHTML = sales.map(function (s) {
      var tub = NG.tubFor(s.tub_model), idx = ORDER.indexOf(s.status);
      var steps = STEPS.map(function (st, i) {
        var state = idx >= i ? 'done' : (idx + 1 === i ? 'next' : '');
        var label = st[0] === 'deposit_paid' && s.payment_type === 'full' ? 'Payment received' : st[1];
        return '<li class="' + state + '"><b>' + label + '</b><span>' + (idx >= i || idx + 1 === i ? st[2] : '') + '</span></li>';
      }).join('');
      return '<article class="card mytub">' +
        '<div class="mytub-top">' +
          (tub ? '<img src="/assets/img/' + tub.k + '.webp" alt="Your ' + NG.esc(tub.n) + ' hot tub from above" width="560" height="560">' : '') +
          '<div><p class="eyebrow teal">Your ' + NG.esc(s.tub_line ? s.tub_line + ' line ' : '') + 'hot tub</p>' +
          '<h2>' + NG.esc(s.tub_model ? 'The ' + s.tub_model : (s.sauna_model || 'Your purchase')) + '</h2>' +
          (tub ? '<p class="muted">Seats ' + NG.esc(tub.seats) + ' · ' + tub.jets + ' jets · ' + NG.esc(tub.power) + '</p>' : '') +
          '<dl class="kv">' + dl('Shell colour', s.shell_colour) + dl('Siding', s.siding) + dl('Water care', s.water_care) + dl('Spa cover', s.spa_cover) + dl('Steps', s.steps) + dl('Lifter', s.lifter) + dl('Serial number', s.serial_number) + dl('Agreement', '#' + s.number) + '</dl>' +
          '<div class="formactions"><button class="btn btn-gold" type="button" data-pdf="' + s.id + '">Download my agreement</button></div></div>' +
        '</div>' +
        '<h3>Where things stand</h3><ol class="steps-v">' + steps + '</ol>' +
        '<h3>Your guides</h3><p class="muted">Read the pre-delivery guide before we book delivery. Getting the base, power and access right is what makes delivery day smooth and protects your warranty.</p>' +
        '<div class="formactions"><a class="btn btn-ink" href="/assets/docs/north-grenville-pre-delivery-guide.pdf" target="_blank" rel="noopener">Pre-delivery guide</a><a class="btn btn-line" href="/assets/docs/north-grenville-owners-manual.pdf" target="_blank" rel="noopener">Owner\'s manual</a></div>' +
        '<h3>Questions?</h3><p>Call or text Blaine directly at <b>(613) 292-1786</b>. He answers his own phone. Soon you\'ll also be able to send questions and book delivery right here.</p>' +
      '</article>';
    }).join('');
    document.querySelectorAll('[data-pdf]').forEach(function (b) {
      b.addEventListener('click', function () {
        NG.api('agreement-pdf', { sale_id: b.dataset.pdf }).then(function (r) { location.href = r.url; }).catch(function (e) { NG.toast(e.message); });
      });
    });
  }

  NG.requireRole(['customer', 'admin', 'staff']).then(function (me) {
    $('#signOut').addEventListener('click', NG.signOut);
    NG.sb.from('customers').select('id').eq('user_id', me.user.id).then(function (c) {
      var ids = (c.data || []).map(function (x) { return x.id; });
      if (!ids.length) return render(me, []);
      NG.sb.from('sales').select('*').in('customer_id', ids).neq('status', 'cancelled').neq('status', 'draft').order('created_at', { ascending: false })
        .then(function (r) { render(me, r.data || []); });
    });
  });
})();
