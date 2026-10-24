(function () {
  var $ = function (s) { return document.querySelector(s); };
  var t = new URLSearchParams(location.search).get('t') || '';
  var pad = null;
  function row(label, value) { return value ? '<div><dt>' + label + '</dt><dd>' + NG.esc(value) + '</dd></div>' : ''; }
  function err(m) { $('#signLoading').hidden = true; var e = $('#signError'); e.innerHTML = '<p>' + NG.esc(m) + '</p><p>Call or text Blaine at (613) 292-1786.</p>'; e.hidden = false; }
  if (!t) return err('This signing link is missing its code. Please use the link from your email.');

  fetch(NG.FN + 'signing?t=' + encodeURIComponent(t)).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); }).then(function (res) {
    if (!res.ok) return err(res.d.error || 'We couldn\'t load this agreement.');
    var a = res.d, c = a.customer, kind = a.product_type || 'hot_tub', isSauna = kind === 'sauna', noun = NG.noun(a);
    var pic = NG.productFor(kind, isSauna ? a.sauna_model : a.tub_model);
    $('#signTitle').textContent = 'Agreement #' + a.number;
    var photo = pic ? '<img class="signphoto" src="/assets/img/' + pic.img + '.webp" alt="The ' + NG.esc(pic.n) + ' ' + noun + '" width="560" height="560">' : '';
    var sub = Number(a.hot_tub_value) + Number(a.sauna_total) + Number(a.delivery_fee);
    $('#agreement').innerHTML =
      '<div class="card agree">' + photo +
      '<h2>' + NG.esc([!isSauna && a.tub_model && ((a.tub_make ? a.tub_make + ' ' : '') + a.tub_model + ' ' + noun), a.sauna_model && ((isSauna && a.sauna_make ? a.sauna_make + ' ' : '') + a.sauna_model + ' sauna')].filter(Boolean).join(' and ')) + '</h2>' +
      '<p class="muted">Prepared by ' + NG.esc(a.rep_name) + ' on ' + NG.esc(a.sale_date) + '</p>' +
      '<h3>Your details</h3><dl class="kv">' + row('Name', c.name) + row('Address', [c.address, c.city_pc].filter(Boolean).join(', ')) + row('Cell', c.cell) + row('Email', c.email) + '</dl>' +
      (!isSauna && a.tub_model ? '<h3>' + NG.cap(noun) + '</h3><dl class="kv">' + row('Make', a.tub_make) + row('Model', a.tub_model) + row('Shell colour', a.shell_colour) + row('Siding', a.siding) + row('Water care', a.water_care) + row('Stereo', a.stereo) + row('Starter kit', a.starter_kit) + row('Steps', a.steps) + row('Lifter', a.lifter) + row('Cover', a.spa_cover) + row('Other', a.other) + row('Estimated delivery time', a.est_delivery) + '</dl>' : '') +
      (a.sauna_model ? '<h3>Sauna</h3><dl class="kv">' + row('Make', a.sauna_make) + row('Model', a.sauna_model) + row('Electrical', a.sauna_electrical) + (isSauna ? row('Other', a.other) + row('Estimated delivery time', a.est_delivery) : '') + '</dl>' : '') +
      (a.notes ? '<h3>Notes</h3><p>' + NG.esc(a.notes) + '</p>' : '') +
      '<h3>Price</h3><dl class="sums">' +
      [[NG.cap(isSauna ? 'sauna' : noun), isSauna ? a.sauna_total : a.hot_tub_value], [isSauna ? '' : 'Sauna', isSauna ? 0 : a.sauna_total], ['Delivery', a.delivery_fee], ['Subtotal', sub], ['HST (' + Math.round(a.tax_rate * 100) + '%)', a.tax], ['Total', a.total, 1], [a.payment_type === 'full' ? 'Paid in full on signing' : 'Paid online on signing', a.deposit], ['Balance ' + ({ cash: 'paid in cash', cheque: 'paid by cheque', financing: 'through financing' }[a.balance_method] || 'due before delivery'), a.balance, 1]]
        .filter(function (r) { return r[2] || Number(r[1]) > 0 || r[0] === 'Subtotal'; })
        .map(function (r) { return '<div' + (r[2] ? ' class="strong"' : '') + '><dt>' + r[0] + '</dt><dd>' + NG.money(r[1]) + '</dd></div>'; }).join('') + '</dl>' +
      '<p class="muted small">Payment ' + ({ card: 'by credit card', bank: 'by bank transfer' }[a.pay_methods] || 'by card or bank transfer') + ' through a secure QuickBooks link, sent to you once you sign.</p>' +
      '<h3>Terms</h3><p class="terms">' + NG.esc(a.terms.delivery_terms) + '</p><p class="terms">' + NG.esc(a.terms.purchase_terms) + '</p></div>';
    $('#signLoading').hidden = true; $('#agreement').hidden = false; $('#signForm').hidden = false;
    $('#typedName').value = c.name || '';
    pad = NG.signaturePad($('#custSig'));
  }).catch(function () { err('We couldn\'t reach the server. Check your connection and refresh.'); });

  $('#custSigClear').addEventListener('click', function () { pad && pad.clear(); });
  $('#signForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var m = $('#signForm .formmsg'), name = $('#typedName').value.trim();
    if (!$('#agree').checked) { m.textContent = 'Please tick the box to confirm you agree.'; return; }
    if (name.length < 2) { m.textContent = 'Please type your full name.'; return; }
    if (!pad || pad.isEmpty()) { m.textContent = 'Please draw your signature in the box.'; return; }
    var b = $('#signForm button[type=submit]'); b.disabled = true; m.textContent = 'Signing...';
    fetch(NG.FN + 'signing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ t: t, agree: true, typed_name: name, signature: pad.toDataURL() }) })
      .then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (!res.ok) { m.textContent = res.d.error || 'Something went wrong.'; b.disabled = false; return; }
        $('#agreement').hidden = true; $('#signForm').hidden = true; $('#signDone').hidden = false;
        var d = res.d;
        if (d.pay_link) {
          $('#payWhy').textContent = (d.full
            ? 'Your total of ' + NG.money(d.amount) + ' is paid in full, as we agreed. Paying it now confirms your order with Platinum Spas so your tub can be built and shipped to us, and there\'s nothing left to pay on delivery day.'
            : 'Your deposit of ' + NG.money(d.amount) + ', as we agreed, confirms your order with Platinum Spas so your tub can be built and shipped to us. Your remaining balance of ' + NG.money(d.balance) + ' is due before delivery.') +
            ' You can pay ' + d.how + '.';
          $('#payBtn').href = d.pay_link; $('#payBtn').textContent = d.pay_label + ' now';
          $('#payNow').hidden = false;
        }
        $('#signTitle').textContent = 'Signed. Thank you.'; window.scrollTo(0, 0);
      })
      .catch(function () { m.textContent = 'We couldn\'t reach the server. Please try again.'; b.disabled = false; });
  });
})();
