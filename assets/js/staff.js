(function () {
  var sb = NG.sb, me = null, current = null, filter = 'open', pad = null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var form = $('#saleForm');
  var CUST = ['name', 'email', 'cell', 'heard_about', 'address', 'city_pc'];
  // Product fields (category, model, make, electrical, prices) are handled by the product picker below.
  var SALE = ['sale_date', 'est_delivery', 'shell_colour', 'siding', 'water_care', 'stereo', 'starter_kit', 'steps', 'lifter', 'spa_cover', 'other', 'notes', 'payment_type', 'pay_methods', 'balance_method'];
  var WATER = ['shell_colour', 'siding', 'water_care', 'stereo', 'starter_kit', 'steps', 'lifter', 'spa_cover'];
  var MONEY = ['delivery_fee', 'deposit'];
  var TAX = 0.13;

  // ---------- Product picker: category first, then the models in it ----------
  var P = window.NG_PRODUCTS || {};
  var prodType = $('#prodType'), prodModel = $('#prodModel'), prodOther = $('#prodModelOther'), prodMake = $('#prodMake');
  var addonModel = $('#addonModel'), addonOther = $('#addonModelOther'), addonMake = $('#addonMake');
  function modelOptions(type, none) {
    var cat = P[type]; if (!cat) return '';
    return '<option value="">' + none + '</option>' + cat.groups.map(function (g) {
      var o = g.items.map(function (it) { return '<option value="' + NG.esc(it.n) + '">' + NG.esc(it.n) + '</option>'; }).join('');
      return g.name ? '<optgroup label="' + NG.esc(g.name) + '">' + o + '</optgroup>' : o;
    }).join('') + '<option value="__other">Other model (type it in)...</option>';
  }
  function setModelSel(sel, other, v) {
    var listed = !v || !!$('option[value="' + CSS.escape(v) + '"]', sel);
    sel.value = listed ? (v || '') : '__other';
    other.hidden = listed; other.value = listed ? '' : v;
  }
  function modelVal(sel, other) { return sel.value === '__other' ? (other.value.trim() || null) : (sel.value || null); }
  function applyType(keepModel) {
    var t = prodType.value, cat = P[t] || {}, sauna = t === 'sauna';
    var prev = keepModel ? modelVal(prodModel, prodOther) : null;
    prodModel.innerHTML = modelOptions(t, 'Choose a ' + NG.NOUN[t] + '...');
    setModelSel(prodModel, prodOther, prev);
    if (!keepModel || !prodMake.value) prodMake.value = cat.make || '';
    $$('#saleForm .water').forEach(function (l) { l.hidden = sauna; });
    $$('#saleForm .saunaonly').forEach(function (l) { l.hidden = !sauna; });
    $('#addonCard').hidden = sauna;
    $('#mainPriceLabel .lbl').textContent = sauna ? 'Sauna price' : NG.cap(NG.NOUN[t]) + ' value';
    $('#addonPriceLabel').hidden = sauna;
    sums();
  }
  addonModel.innerHTML = modelOptions('sauna', 'No sauna');
  prodType.addEventListener('change', function () { applyType(false); });
  [[prodModel, prodOther], [addonModel, addonOther]].forEach(function (p) {
    p[0].addEventListener('change', function () { p[1].hidden = p[0].value !== '__other'; if (!p[1].hidden) p[1].focus(); });
  });
  addonModel.addEventListener('change', function () { if (addonModel.value && !addonMake.value) addonMake.value = 'Hekla'; });

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function sums() {
    var tub = num(form.hot_tub_value.value), sauna = prodType.value === 'sauna' ? 0 : num(form.sauna_total.value), del = num(form.delivery_fee.value);
    var sub = tub + sauna + del, tax = Math.round(sub * TAX * 100) / 100, tot = Math.round((sub + tax) * 100) / 100;
    var full = form.payment_type.value === 'full';
    // Paid in full: the amount due on signing is the whole total, so the deposit box follows it.
    if (full) form.deposit.value = tot ? tot.toFixed(2) : '';
    form.deposit.readOnly = full;
    form.deposit.closest('label').firstChild.textContent = full ? 'Amount due on signing' : 'Paid online on signing';
    $('#balanceMethodLabel').hidden = full;
    var dep = num(form.deposit.value);
    $('#sums').innerHTML = [['Products', tub + sauna], ['Delivery', del], ['Subtotal', sub], ['HST (13%)', tax], ['Total', tot, 1], [full ? 'Paid in full' : 'Paid online on signing', dep], ['Balance' + (full ? '' : ' (' + ({ cash: 'cash', cheque: 'cheque', financing: 'financing' }[form.balance_method.value] || 'before delivery') + ')'), tot - dep, 1]]
      .map(function (r) { return '<div' + (r[2] ? ' class="strong"' : '') + '><dt>' + r[0] + '</dt><dd>' + NG.money(r[1]) + '</dd></div>'; }).join('');
  }
  MONEY.forEach(function (k) { form[k].addEventListener('input', sums); });
  form.payment_type.addEventListener('change', sums);
  ['hot_tub_value', 'sauna_total'].forEach(function (k) { form[k].addEventListener('input', sums); });
  form.balance_method.addEventListener('change', sums);

  function show(view) {
    $$('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + view; });
    $$('.tabs a').forEach(function (a) { a.removeAttribute('aria-current'); });
    var tab = view === 'sale' ? (current && current.id ? 'sales' : 'new') : view === 'customer' ? 'customers' : view;
    var t = $('.tabs a[data-tab="' + tab + '"]'); if (t) t.setAttribute('aria-current', 'page');
    $('#staffTitle').textContent = { sales: 'Sales', sale: current && current.id ? 'Sale #' + current.number : 'New sale', team: 'Team', customers: 'Customers', customer: 'Customer' }[view] || 'Sales';
    window.scrollTo(0, 0);
  }

  function route() {
    var h = location.hash.slice(1) || 'sales';
    if (h === 'team' && me.profile.role === 'admin') { show('team'); loadTeam(); loadQb(); loadCosts(); }
    else if (h === 'new') { openSale(null); }
    else if (h.indexOf('new-c-') === 0) { openSale(null, h.slice(6)); }
    else if (h === 'customers') { show('customers'); loadCustomers(); }
    else if (h === 'lead') { openCustomer(null); }
    else if (h.indexOf('cust-') === 0) { openCustomer(h.slice(5)); }
    else if (h.indexOf('sale-') === 0) { openSale(h.slice(5)); }
    else { show('sales'); loadSales(); }
  }

  // ---------- List ----------
  function loadSales() {
    var q = sb.from('sales').select('id,number,status,total,hot_tub_value,sauna_total,delivery_fee,product_type,tub_model,sauna_model,updated_at,salesperson_id,customers(name),profiles!sales_salesperson_id_fkey(full_name,email)').order('updated_at', { ascending: false }).limit(200);
    if (filter === 'open') q = q.in('status', ['draft', 'awaiting_customer', 'signed', 'deposit_paid', 'delivery_scheduled']);
    else if (filter !== 'all') q = q.eq('status', filter);
    q.then(function (r) {
      var rows = r.data || [], isAdmin = me.profile.role === 'admin';
      $('#saleRows').innerHTML = rows.length ? rows.map(function (s) {
        var what = NG.what(s) || '-';
        var rep = s.profiles ? (s.profiles.full_name || s.profiles.email) : '';
        return '<tr data-id="' + s.id + '" data-n="' + s.number + '" tabindex="0">' + (isAdmin ? '<td class="selcol"><input type="checkbox" class="sel" aria-label="Select sale #' + s.number + '"></td>' : '') + '<td>' + s.number + '</td><td>' + NG.esc(s.customers && s.customers.name) + '</td><td>' + NG.esc(what) + '</td><td class="num">' + NG.money(s.total) + '</td><td>' + NG.pill(s.status) + '</td>' + (isAdmin ? '<td>' + NG.esc(rep) + '</td><td class="num" data-profit="' + s.id + '"></td><td class="num" data-margin="' + s.id + '"></td>' : '') + '<td>' + NG.date(s.updated_at) + '</td></tr>';
      }).join('') : '<tr><td colspan="10" class="empty">No sales here yet. Start one with <a href="#new">New sale</a>.</td></tr>';
      $('#selAll').checked = false; updateBulk();
      if (isAdmin) listProfits(rows);
    });
  }
  $('#saleRows').addEventListener('click', function (e) {
    if (e.target.closest('.selcol')) { if (!e.target.matches('input')) { var cb = e.target.closest('.selcol').querySelector('input'); cb.checked = !cb.checked; } updateBulk(); return; }
    var tr = e.target.closest('tr[data-id]'); if (tr) location.hash = 'sale-' + tr.dataset.id;
  });

  // ---------- Bulk delete (admins) ----------
  function selected() { return $$('#saleRows .sel:checked').map(function (cb) { return cb.closest('tr'); }); }
  function updateBulk() {
    var n = selected().length, b = $('#bulkDelete');
    $('#bulkBar').hidden = me.profile.role !== 'admin' || !n;
    $('#bulkCount').textContent = n + (n === 1 ? ' sale selected' : ' sales selected');
    b.dataset.confirm = ''; b.textContent = 'Delete selected'; $('#bulkMsg').textContent = '';
  }
  $('#selAll').addEventListener('change', function () { var on = this.checked; $$('#saleRows .sel').forEach(function (cb) { cb.checked = on; }); updateBulk(); });
  $('#bulkClear').addEventListener('click', function () { $('#selAll').checked = false; $$('#saleRows .sel').forEach(function (cb) { cb.checked = false; }); updateBulk(); });
  $('#bulkDelete').addEventListener('click', function () {
    var b = this, rows = selected(); if (!rows.length) return;
    var nums = rows.map(function (tr) { return '#' + tr.dataset.n; }).join(', ');
    if (b.dataset.confirm !== '1') {
      b.dataset.confirm = '1'; b.textContent = 'Tap again to delete ' + nums + ' for good';
      setTimeout(function () { if (b.dataset.confirm === '1') { b.dataset.confirm = ''; b.textContent = 'Delete selected'; } }, 6000); return;
    }
    b.disabled = true; $('#bulkMsg').textContent = 'Deleting...';
    NG.api('sale-delete', { sale_ids: rows.map(function (tr) { return tr.dataset.id; }) })
      .then(function (r) { NG.toast(r.deleted === 1 ? 'Sale deleted' : r.deleted + ' sales deleted'); loadSales(); })
      .catch(function (err) { $('#bulkMsg').textContent = err.message; })
      .finally(function () { b.disabled = false; });
  });
  $('#saleRows').addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') location.hash = 'sale-' + tr.dataset.id; });
  $$('.filters .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('.filters .chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); c.setAttribute('aria-pressed', 'true');
      filter = c.dataset.st; loadSales();
    });
  });

  // ---------- Editor ----------
  function fill(s, c) {
    CUST.forEach(function (k) { form['c_' + k].value = (c && c[k]) || ''; });
    SALE.forEach(function (k) { if (form[k]) form[k].value = (s && s[k] != null) ? s[k] : ''; });
    MONEY.forEach(function (k) { form[k].value = s && Number(s[k]) ? s[k] : ''; });
    var t = (s && s.product_type) || 'hot_tub', sauna = t === 'sauna';
    prodType.value = t; prodMake.value = ''; applyType(false);
    setModelSel(prodModel, prodOther, s ? (sauna ? s.sauna_model : s.tub_model) : null);
    prodMake.value = s ? ((sauna ? s.sauna_make : s.tub_make) || (P[t] || {}).make || '') : (P[t] || {}).make || '';
    $('#mainElectrical').value = s && sauna ? (s.sauna_electrical || '') : '';
    var mainPrice = s ? Number(sauna ? s.sauna_total : s.hot_tub_value) : 0;
    form.hot_tub_value.value = mainPrice ? mainPrice : '';
    setModelSel(addonModel, addonOther, s && !sauna ? s.sauna_model : null);
    addonMake.value = s && !sauna ? (s.sauna_make || '') : '';
    $('#addonElectrical').value = s && !sauna ? (s.sauna_electrical || '') : '';
    form.sauna_total.value = s && !sauna && Number(s.sauna_total) ? s.sauna_total : '';
    if (!s) { form.sale_date.value = new Date().toISOString().slice(0, 10); form.payment_type.value = 'full'; form.pay_methods.value = 'both'; }
    if (!form.balance_method.value) form.balance_method.value = 'before_delivery';
    sums();
  }
  function lock(locked) {
    $$('input,select,textarea', form).forEach(function (el) { el.disabled = locked; });
    $('#saveBtn').hidden = locked; $('#deleteBtn').hidden = locked || !current || !current.id;
    $('#lockNote').hidden = !locked || (current && current.status !== 'awaiting_customer');
  }
  var newForCustomer = null; // starting a sale for an existing customer (a lead)
  function openSale(id, custId) {
    current = null; newForCustomer = null; form.querySelector('.formmsg').textContent = '';
    ['#signPanel', '#paperPanel', '#waitPanel', '#donePanel', '#eventsPanel', '#saleDanger', '#profitCard'].forEach(function (p) { $(p).hidden = true; });
    if (!id) {
      fill(null, null); lock(false); $('#saleHeading').textContent = 'New sale'; $('#saleStatus').innerHTML = ''; show('sale');
      if (custId) sb.from('customers').select('*').eq('id', custId).maybeSingle().then(function (r) {
        if (!r.data) return;
        newForCustomer = r.data;
        CUST.forEach(function (k) { form['c_' + k].value = r.data[k] || ''; });
        $('#saleHeading').textContent = 'New sale for ' + r.data.name;
      });
      return;
    }
    sb.from('sales').select('*, customers(*)').eq('id', id).maybeSingle().then(function (r) {
      if (!r.data) { NG.toast("That sale wasn't found."); location.hash = 'sales'; return; }
      current = r.data; fill(current, current.customers);
      $('#saleHeading').textContent = 'Sale #' + current.number + ' · ' + (current.customers ? current.customers.name : '');
      $('#saleStatus').innerHTML = NG.pill(current.status);
      lock(current.status !== 'draft');
      if (current.status === 'draft') { $('#signPanel').hidden = false; $('#repName').textContent = me.profile.full_name || me.profile.email; if (!pad) pad = NG.signaturePad($('#repSig')); else pad.clear(); }
      if (current.status === 'draft' || current.status === 'awaiting_customer') {
        $('#paperPanel').hidden = false; $('#paperConfirm').checked = false; $('#paperPhotos').value = '';
        $('#printMsg').textContent = ''; $('#paperMsg').textContent = ''; photoCount();
      }
      if (current.status === 'awaiting_customer') {
        $('#waitPanel').hidden = false;
        var link = current.sign_token ? location.origin + '/sign/?t=' + current.sign_token : '';
        $('#signLink').value = link; $('#openSign').href = link || '#';
      }
      if (current.agreement_pdf_path) {
        $('#donePanel').hidden = false;
        renderDeposit(); renderProgress();
        $('#doneText').textContent = (current.signing_method === 'paper'
          ? 'Signed on paper, recorded ' + NG.dateTime(current.customer_signed_at) + '. '
          : (current.customer_typed_name || 'The customer') + ' signed on ' + NG.dateTime(current.customer_signed_at) + '. ') +
          'They were emailed their copy, the pre-delivery guide, the owner\'s manual and a link to their portal.';
      }
      // Admins can delete any sale (tests, deals that fell through). Salespeople keep the Delete draft button.
      $('#saleDanger').hidden = me.profile.role !== 'admin';
      openProfit(current);
      $('#saleDelMsg').textContent = ''; $('#saleDelete').dataset.confirm = ''; $('#saleDelete').textContent = 'Delete sale';
      loadEvents(current.id);
      show('sale');
    });
  }
  function loadEvents(id) {
    sb.from('sale_events').select('at,kind,detail').eq('sale_id', id).order('at').then(function (r) {
      var L = { qb_invoice_created: 'Deposit invoice created in QuickBooks', qb_invoice_failed: 'QuickBooks invoice could not be created', pay_link_emailed: 'Deposit pay link emailed', deposit_paid: 'Deposit received', rep_signed: 'Signed by salesperson and sent for signature', link_emailed: 'Signing link emailed to customer', link_resent: 'New signing link created', customer_signed: 'Customer signed', welcome_sent: 'Welcome email sent with agreement, guide and manual', welcome_failed: 'Welcome email failed to send', balance_paid: 'Balance recorded as paid', undo_balance: 'Balance payment undone', delivered: 'Marked delivered', undo_delivered: 'Delivery undone', paper_signed: 'Signed on paper', printed_for_paper: 'Printed for paper signing', reopened: 'Unlocked for changes (old signing link cancelled)' };
      var ev = r.data || []; if (!ev.length) return;
      $('#events').innerHTML = ev.map(function (e) { return '<li><b>' + NG.esc(L[e.kind] || e.kind) + '</b><span>' + NG.dateTime(e.at) + '</span></li>'; }).join('');
      $('#eventsPanel').hidden = false;
    });
  }

  function collect() {
    var c = {}, s = {};
    CUST.forEach(function (k) { c[k] = form['c_' + k].value.trim() || null; });
    SALE.forEach(function (k) { var el = form.querySelector('[name="' + k + '"]'); if (el) s[k] = el.value.trim() || null; });
    MONEY.forEach(function (k) { s[k] = num(form[k].value); });
    var type = prodType.value, model = modelVal(prodModel, prodOther), make = prodMake.value.trim() || null;
    s.product_type = type;
    if (type === 'sauna') {
      s.sauna_make = make; s.sauna_model = model; s.sauna_electrical = $('#mainElectrical').value.trim() || null; s.sauna_total = num(form.hot_tub_value.value);
      s.tub_make = null; s.tub_model = null; s.tub_line = null; s.hot_tub_value = 0;
      WATER.forEach(function (k) { s[k] = null; });
    } else {
      s.tub_make = make; s.tub_model = model; s.hot_tub_value = num(form.hot_tub_value.value);
      var t = type === 'hot_tub' ? NG.tubFor(model) : null; s.tub_line = t ? t.lineName : null;
      var am = modelVal(addonModel, addonOther);
      s.sauna_model = am; s.sauna_make = am ? (addonMake.value.trim() || 'Hekla') : null;
      s.sauna_electrical = am ? ($('#addonElectrical').value.trim() || null) : null;
      s.sauna_total = am ? num(form.sauna_total.value) : 0;
    }
    if (!s.sale_date) delete s.sale_date;
    return { c: c, s: s };
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var msg = form.querySelector('.formmsg'), d = collect();
    if (!d.c.name || !d.c.email || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.c.email)) { msg.textContent = 'Add the customer\'s name and a valid email first.'; return; }
    msg.textContent = 'Saving...';
    var done = function (saleId) { msg.textContent = 'Saved.'; NG.toast('Draft saved'); if (location.hash !== '#sale-' + saleId) location.hash = 'sale-' + saleId; else openSale(saleId); };
    var fail = function (err) { msg.textContent = (err && err.message) || 'Could not save. Please try again.'; };
    if (current && current.id) {
      sb.from('customers').update(d.c).eq('id', current.customer_id).then(function (r1) {
        if (r1.error) return fail(r1.error);
        sb.from('sales').update(d.s).eq('id', current.id).then(function (r2) { r2.error ? fail(r2.error) : done(current.id); });
      });
    } else if (newForCustomer) {
      var cid = newForCustomer.id;
      sb.from('customers').update(d.c).eq('id', cid).then(function (r1) {
        if (r1.error) return fail(r1.error);
        d.s.customer_id = cid; d.s.salesperson_id = me.user.id; d.s.status = 'draft';
        sb.from('sales').insert(d.s).select('id').single().then(function (r2) { r2.error ? fail(r2.error) : done(r2.data.id); });
      });
    } else {
      d.c.created_by = me.user.id;
      sb.from('customers').insert(d.c).select('id').single().then(function (r1) {
        if (r1.error) return fail(r1.error);
        d.s.customer_id = r1.data.id; d.s.salesperson_id = me.user.id; d.s.status = 'draft';
        sb.from('sales').insert(d.s).select('id').single().then(function (r2) { r2.error ? fail(r2.error) : done(r2.data.id); });
      });
    }
  });

  $('#deleteBtn').addEventListener('click', function () {
    var b = $('#deleteBtn');
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Tap again to delete'; setTimeout(function () { b.dataset.confirm = ''; b.textContent = 'Delete draft'; }, 4000); return; }
    sb.from('sales').delete().eq('id', current.id).then(function (r) { if (r.error) return NG.toast(r.error.message); NG.toast('Draft deleted'); location.hash = 'sales'; });
  });

  $('#reopenBtn').addEventListener('click', function () {
    var b = this, m = $('#reopenMsg'); if (!current) return;
    if (b.dataset.confirm !== '1') {
      b.dataset.confirm = '1'; b.textContent = 'Tap again to unlock and cancel the link';
      setTimeout(function () { if (b.dataset.confirm === '1') { b.dataset.confirm = ''; b.textContent = 'Edit this agreement'; } }, 5000); return;
    }
    b.disabled = true; m.textContent = 'Unlocking...';
    NG.api('sale-reopen', { sale_id: current.id })
      .then(function () { NG.toast('Unlocked. Make your changes, then sign and send again.'); b.dataset.confirm = ''; b.textContent = 'Edit this agreement'; m.textContent = ''; openSale(current.id); })
      .catch(function (err) { m.textContent = err.message; })
      .finally(function () { b.disabled = false; });
  });

  $('#saleDelete').addEventListener('click', function () {
    var b = this, m = $('#saleDelMsg'); if (!current) return;
    if (b.dataset.confirm !== '1') {
      b.dataset.confirm = '1'; b.textContent = 'Tap again to delete sale #' + current.number + ' for good';
      setTimeout(function () { if (b.dataset.confirm === '1') { b.dataset.confirm = ''; b.textContent = 'Delete sale'; } }, 5000); return;
    }
    b.disabled = true; m.textContent = 'Deleting...';
    NG.api('sale-delete', { sale_ids: [current.id] })
      .then(function () { NG.toast('Sale #' + current.number + ' deleted'); location.hash = 'sales'; })
      .catch(function (err) { m.textContent = err.message; })
      .finally(function () { b.disabled = false; });
  });

  $('#repSigClear').addEventListener('click', function () { pad && pad.clear(); });
  function sendForSignature(emailCustomer) {
    var m = $('#signMsg');
    if (!current || !current.id) return;
    if (!pad || pad.isEmpty()) { m.textContent = 'Please sign in the box first.'; return; }
    // Save any last edits first, then lock and sign.
    var d = collect();
    m.textContent = 'Saving and signing...';
    $$('#signPanel button').forEach(function (b) { b.disabled = true; });
    sb.from('customers').update(d.c).eq('id', current.customer_id).then(function () { return sb.from('sales').update(d.s).eq('id', current.id); })
      .then(function () { return NG.api('send-for-signature', { sale_id: current.id, rep_signature: pad.toDataURL(), email_customer: emailCustomer }); })
      .then(function (r) {
        if (emailCustomer) { NG.toast('Signing link emailed to ' + d.c.email); openSale(current.id); }
        else location.href = r.sign_url;
      })
      .catch(function (err) { m.textContent = err.message; })
      .finally(function () { $$('#signPanel button').forEach(function (b) { b.disabled = false; }); });
  }
  $('#signEmail').addEventListener('click', function () { sendForSignature(true); });
  $('#signHere').addEventListener('click', function () { sendForSignature(false); });
  $('#copyLink').addEventListener('click', function () { NG.copy($('#signLink').value); });
  $('#resendLink').addEventListener('click', function () {
    var m = $('#waitMsg'); m.textContent = 'Sending...';
    NG.api('send-for-signature', { sale_id: current.id, email_customer: true }).then(function () { m.textContent = 'A fresh link was emailed. The old link no longer works.'; openSale(current.id); })
      .catch(function (err) { m.textContent = err.message; });
  });
  $('#downloadPdf').addEventListener('click', function () {
    NG.api('agreement-pdf', { sale_id: current.id }).then(function (r) { location.href = r.url; }).catch(function (err) { NG.toast(err.message); });
  });
  // ---------- Printing ----------
  // Computers get the print dialog right away; phones and tablets open the PDF, to print from the share menu.
  function printAgreement(msg) {
    msg.textContent = 'Getting the agreement ready...';
    var touch = /iPad|iPhone|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.platform));
    var win = touch ? window.open('', '_blank') : null; // opened now so the browser doesn't block it
    NG.api('agreement-print', { sale_id: current.id }).then(function (r) {
      var bin = atob(r.pdf), bytes = new Uint8Array(bin.length);
      for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      var url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      if (win) { win.location.href = url; msg.textContent = 'Opened in a new tab. Tap the share button there, then Print.'; return; }
      var old = document.getElementById('printFrame'); if (old) old.remove();
      var f = document.createElement('iframe');
      f.id = 'printFrame'; f.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
      f.onload = function () {
        setTimeout(function () {
          try { f.contentWindow.focus(); f.contentWindow.print(); msg.textContent = ''; }
          catch (e) { window.open(url, '_blank'); msg.textContent = 'Opened in a new tab. Print it from there.'; }
        }, 300);
      };
      f.src = url; document.body.appendChild(f);
    }).catch(function (err) { if (win) win.close(); msg.textContent = err.message; });
  }
  $('#printPdf').addEventListener('click', function () { printAgreement($('#pdfMsg')); });
  $('#printPaper').addEventListener('click', function () { printAgreement($('#printMsg')); });

  // Photos of signed paper pages are shrunk on the device first so they upload quickly.
  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1800 / Math.max(img.width, img.height));
        var c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = function () { reject(new Error("One of the photos couldn't be read. Try a JPG or PNG.")); };
      img.src = url;
    });
  }
  function photoCount() {
    var n = $('#paperPhotos').files.length;
    $('#photoCount').textContent = n ? n + ' photo' + (n > 1 ? 's' : '') + ' ready' + (n > 6 ? ' (only the first 6 are kept)' : '') + '.' :
      'A photo of each signed page keeps a backup with the sale, in case the paper copy goes missing.';
  }
  $('#paperPhotos').addEventListener('change', photoCount);
  $('#markPaper').addEventListener('click', function () {
    var m = $('#paperMsg');
    if (!$('#paperConfirm').checked) { m.textContent = 'Please tick the box to confirm you both signed.'; return; }
    var btn = this; btn.disabled = true; m.textContent = 'Saving...';
    var files = Array.prototype.slice.call($('#paperPhotos').files, 0, 6);
    Promise.all(files.map(shrink))
      .then(function (photos) { m.textContent = 'Saving and sending the welcome email...'; return NG.api('paper-signed', { sale_id: current.id, photos: photos, confirm: true }); })
      .then(function () { NG.toast('Marked as signed. The customer has been emailed.'); openSale(current.id); })
      .catch(function (err) { m.textContent = err.message; })
      .finally(function () { btn.disabled = false; });
  });

  // ---------- Deposit (QuickBooks) ----------
  function renderDeposit() {
    var box = $('#depositBox'), s = current;
    var full = s.payment_type === 'full', H = full ? '<h3>Payment</h3>' : '<h3>Deposit</h3>';
    if (s.status === 'deposit_paid' || s.deposit_paid_at) { box.innerHTML = H + '<p>' + NG.pill('deposit_paid').replace('Deposit received', full ? 'Paid in full' : 'Deposit received') + ' ' + NG.money(s.deposit) + ' received ' + NG.dateTime(s.deposit_paid_at) + '. Time to place the order with Platinum Spas.</p>'; return; }
    if (!(Number(s.deposit) > 0)) { box.innerHTML = ''; return; }
    if (s.qb_deposit_invoice_id) {
      box.innerHTML = H + '<p>QuickBooks invoice created for ' + NG.money(s.deposit) + (full ? ' (paid in full)' : ' (deposit)') + '. It updates on its own within 15 minutes of the customer paying.</p>' +
        '<div class="formactions">' + (s.qb_invoice_link ? '<button class="btn btn-line btn-sm" type="button" id="copyPay">Copy pay link</button><button class="btn btn-ink btn-sm" type="button" id="emailPay">Email pay link to customer</button>' : '') + '<p class="formmsg" id="payMsg"></p></div>';
    } else {
      box.innerHTML = H + '<p class="muted">No QuickBooks invoice yet for the ' + NG.money(s.deposit) + (full ? ' payment' : ' deposit') + '.</p><div class="formactions"><button class="btn btn-gold btn-sm" type="button" id="makeInvoice">Create invoice and email pay link</button><p class="formmsg" id="payMsg"></p></div>';
    }
    var cp = $('#copyPay'); if (cp) cp.onclick = function () { NG.copy(s.qb_invoice_link); };
    var send = function () {
      $('#payMsg').textContent = 'Working...';
      NG.api('qb-invoice', { sale_id: s.id, email_customer: true }).then(function () { $('#payMsg').textContent = 'Pay link emailed to the customer.'; openSale(s.id); })
        .catch(function (e) { $('#payMsg').textContent = e.message; });
    };
    var ep = $('#emailPay'); if (ep) ep.onclick = send;
    var mk = $('#makeInvoice'); if (mk) mk.onclick = send;
  }

  // ---------- After the deposit: balance and delivery ----------
  function renderProgress() {
    var box = $('#progressBox'), s = current;
    if (!s || ['signed', 'deposit_paid', 'delivery_scheduled', 'delivered'].indexOf(s.status) < 0) { box.innerHTML = ''; return; }
    var owing = Number(s.balance) > 0, today = new Date().toISOString().slice(0, 10), h = '<h3>Balance and delivery</h3>';
    if (owing) {
      h += s.balance_paid_at
        ? '<p>' + NG.pill('deposit_paid').replace('Deposit received', 'Balance paid') + ' ' + NG.money(s.balance) + ' recorded ' + NG.date(s.balance_paid_at) + '. <button class="textbtn" type="button" data-prog="undo_balance">Undo</button></p>'
        : '<div class="progrow"><p>Balance of <b>' + NG.money(s.balance) + '</b> still owing.</p><label>Paid on<input type="date" id="balDate" value="' + today + '"></label><button class="btn btn-line btn-sm" type="button" data-prog="balance_paid">Record balance paid</button></div>';
    }
    h += s.status === 'delivered'
      ? '<p>' + NG.pill('delivered') + ' ' + NG.date(s.delivered_at) + (s.serial_number ? ' · Serial ' + NG.esc(s.serial_number) : '') + '. <button class="textbtn" type="button" data-prog="undo_delivered">Undo</button></p>'
      : '<div class="progrow"><label>Delivered on<input type="date" id="delDate" value="' + today + '"></label><label>Serial number<input id="delSerial" value="' + NG.esc(s.serial_number || '') + '" placeholder="From the tub"></label><button class="btn btn-gold btn-sm" type="button" data-prog="delivered">Mark delivered</button></div>';
    box.innerHTML = h + '<p class="formmsg" id="progMsg" role="status" aria-live="polite"></p>';
    $$('[data-prog]', box).forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.dataset.prog, body = { sale_id: s.id, action: a };
        if (a === 'balance_paid') body.date = $('#balDate').value;
        if (a === 'delivered') { body.date = $('#delDate').value; body.serial_number = $('#delSerial').value.trim(); }
        b.disabled = true; $('#progMsg').textContent = 'Saving...';
        NG.api('sale-progress', body).then(function () { NG.toast('Saved'); openSale(s.id); })
          .catch(function (err) { $('#progMsg').textContent = err.message; b.disabled = false; });
      });
    });
  }

  // ---------- Customers ----------
  var STAGES = {
    lead: ['Lead', 'grey'], payment_due: ['Payment due', 'amber'], balance: ['Paid, balance owing', 'teal'],
    waiting: ['Waiting for delivery', 'gold'], delivered: ['Delivered', 'green']
  };
  var SIGNED = ['signed', 'deposit_paid', 'delivery_scheduled', 'delivered'];
  function stageOf(c) {
    var deals = (c.sales || []).filter(function (x) { return SIGNED.indexOf(x.status) >= 0; })
      .sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
    if (!deals.length) return { key: 'lead', deal: (c.sales || [])[0] || null };
    var d = deals[0];
    if (d.status === 'delivered') return { key: 'delivered', deal: d };
    if (d.status === 'signed') return { key: 'payment_due', deal: d };
    if (Number(d.balance) > 0 && !d.balance_paid_at) return { key: 'balance', deal: d };
    return { key: 'waiting', deal: d };
  }
  function stagePill(k) { var st = STAGES[k]; return '<span class="pill pill-' + st[1] + '">' + st[0] + '</span>'; }
  var custCache = [], custStage = 'all';
  function loadCustomers() {
    sb.from('customers').select('id,name,email,cell,city_pc,created_at,created_by,sales(id,number,status,total,balance,balance_paid_at,product_type,tub_model,sauna_model,created_at,salesperson_id,profiles!sales_salesperson_id_fkey(full_name,email))')
      .order('created_at', { ascending: false }).limit(1000).then(function (r) {
        if (r.error) { $('#custRows').innerHTML = '<tr><td colspan="7" class="empty">' + NG.esc(r.error.message) + '</td></tr>'; return; }
        custCache = (r.data || []).map(function (c) { var st = stageOf(c); c._stage = st.key; c._deal = st.deal; return c; });
        renderCustomers();
      });
  }
  function renderCustomers() {
    var counts = { all: custCache.length }; Object.keys(STAGES).forEach(function (k) { counts[k] = 0; });
    custCache.forEach(function (c) { counts[c._stage]++; });
    $$('#custFilters .chip').forEach(function (b) { b.querySelector('span').textContent = counts[b.dataset.stage] ? '(' + counts[b.dataset.stage] + ')' : ''; });
    var q = ($('#custSearch').value || '').toLowerCase().trim(), isAdmin = me.profile.role === 'admin';
    var rows = custCache.filter(function (c) {
      if (custStage !== 'all' && c._stage !== custStage) return false;
      return !q || [c.name, c.email, c.cell, c.city_pc].join(' ').toLowerCase().indexOf(q) >= 0;
    });
    $('#custRows').innerHTML = rows.length ? rows.map(function (c) {
      var d = c._deal, what = d ? '#' + d.number + ' ' + (NG.what(d) || '') : '-';
      var bal = d && SIGNED.indexOf(d.status) >= 0 ? (d.balance_paid_at ? 0 : Number(d.balance)) : null;
      var rep = d && d.profiles ? (d.profiles.full_name || d.profiles.email) : '';
      return '<tr data-cid="' + c.id + '" tabindex="0"><td><b>' + NG.esc(c.name) + '</b></td><td>' + NG.esc([c.cell, c.email].filter(Boolean).join(' · ') || '-') + '</td><td>' + stagePill(c._stage) + '</td><td>' + NG.esc(what) + '</td><td class="num">' + (bal == null ? '-' : NG.money(bal)) + '</td>' + (isAdmin ? '<td>' + NG.esc(rep) + '</td>' : '') + '<td>' + NG.date(c.created_at) + '</td></tr>';
    }).join('') : '<tr><td colspan="7" class="empty">' + (custCache.length ? 'No customers match.' : 'No customers yet. <a href="#lead">Add a lead</a> or start a <a href="#new">new sale</a>.') + '</td></tr>';
  }
  $('#custRows').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-cid]'); if (tr) location.hash = 'cust-' + tr.dataset.cid; });
  $('#custRows').addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-cid]'); if (tr && e.key === 'Enter') location.hash = 'cust-' + tr.dataset.cid; });
  $('#custSearch').addEventListener('input', renderCustomers);
  $$('#custFilters .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('#custFilters .chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); c.setAttribute('aria-pressed', 'true');
      custStage = c.dataset.stage; renderCustomers();
    });
  });

  var currentCust = null, cform = $('#custForm');
  var CFIELDS = ['name', 'email', 'cell', 'heard_about', 'address', 'city_pc', 'notes'];
  function openCustomer(id) {
    currentCust = null; cform.querySelector('.formmsg').textContent = ''; $('#custDelMsg').textContent = '';
    $('#custDeals').hidden = true; $('#custDanger').hidden = true; $('#custNewSale').hidden = true; $('#custStage').innerHTML = '';
    var del = $('#custDelete'); del.dataset.confirm = ''; del.textContent = 'Delete customer';
    if (!id) { CFIELDS.forEach(function (k) { cform[k].value = ''; }); $('#custHeading').textContent = 'New lead'; show('customer'); cform.name.focus(); return; }
    sb.from('customers').select('*, sales(id,number,status,total,balance,deposit,balance_paid_at,product_type,tub_model,sauna_model,created_at,updated_at)').eq('id', id).maybeSingle().then(function (r) {
      if (!r.data) { NG.toast("That customer wasn't found."); location.hash = 'customers'; return; }
      var c = currentCust = r.data, st = stageOf(c);
      CFIELDS.forEach(function (k) { cform[k].value = c[k] || ''; });
      $('#custHeading').textContent = c.name; $('#custStage').innerHTML = stagePill(st.key);
      $('#custNewSale').href = '#new-c-' + c.id; $('#custNewSale').hidden = false;
      var deals = (c.sales || []).sort(function (a, b) { return a.created_at < b.created_at ? 1 : -1; });
      if (deals.length) {
        $('#custDealList').innerHTML = '<ul class="deallist">' + deals.map(function (d) {
          var what = NG.what(d) || 'Sale';
          return '<li><a href="#sale-' + d.id + '"><b>#' + d.number + ' ' + NG.esc(what) + '</b><span>' + NG.pill(d.status) + ' ' + NG.money(d.total) + (Number(d.balance) > 0 && !d.balance_paid_at && SIGNED.indexOf(d.status) >= 0 ? ' · ' + NG.money(d.balance) + ' owing' : '') + '</span></a></li>';
        }).join('') + '</ul>';
        $('#custDeals').hidden = false;
      }
      // Admins can delete anyone; salespeople can delete their own leads that have no deals.
      $('#custDanger').hidden = !(me.profile.role === 'admin' || (!deals.length && c.created_by === me.user.id));
      show('customer');
    });
  }
  cform.addEventListener('submit', function (e) {
    e.preventDefault();
    var m = cform.querySelector('.formmsg'), d = {};
    CFIELDS.forEach(function (k) { d[k] = cform[k].value.trim() || null; });
    if (!d.name) { m.textContent = 'Add a name first.'; return; }
    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) { m.textContent = 'That email doesn\'t look right.'; return; }
    if (!d.email && !d.cell) { m.textContent = 'Add an email or a cell number so you can follow up.'; return; }
    d.updated_at = new Date().toISOString();
    m.textContent = 'Saving...';
    var q = currentCust ? sb.from('customers').update(d).eq('id', currentCust.id).select('id').single()
      : sb.from('customers').insert(Object.assign(d, { created_by: me.user.id })).select('id').single();
    q.then(function (r) {
      if (r.error) { m.textContent = r.error.message; return; }
      NG.toast('Saved'); if (location.hash !== '#cust-' + r.data.id) location.hash = 'cust-' + r.data.id; else openCustomer(r.data.id);
    });
  });
  $('#custDelete').addEventListener('click', function () {
    var b = this, m = $('#custDelMsg'), c = currentCust; if (!c) return;
    if (b.dataset.confirm !== '1') {
      b.dataset.confirm = '1'; b.textContent = 'Tap again to delete ' + c.name + ' for good';
      setTimeout(function () { b.dataset.confirm = ''; b.textContent = 'Delete customer'; }, 5000); return;
    }
    b.disabled = true; m.textContent = 'Deleting...';
    var hasDeals = (c.sales || []).length > 0;
    var p = hasDeals || me.profile.role === 'admin' ? NG.api('customer-delete', { customer_id: c.id }) : sb.from('customers').delete().eq('id', c.id).then(function (r) { if (r.error) throw r.error; });
    p.then(function () { NG.toast(c.name + ' deleted'); location.hash = 'customers'; })
      .catch(function (err) { m.textContent = err.message; }).finally(function () { b.disabled = false; });
  });

  // ---------- QuickBooks settings (admins) ----------
  function loadQb() {
    var body = $('#qbBody');
    var flag = new URLSearchParams(location.search).get('qb');
    var banner = flag ? '<p class="note">' + ({ connected: 'QuickBooks is connected.', cancelled: 'QuickBooks connection was cancelled.', failed: 'QuickBooks connection failed. Please try again.' }[flag] || '') + '</p>' : '';
    NG.api('qb-status', {}).then(function (st) {
      if (!st.configured) { body.innerHTML = banner + '<p>Add <b>QB_CLIENT_ID</b> and <b>QB_CLIENT_SECRET</b> on the Supabase secrets page, then refresh.</p>'; return; }
      if (!st.connected) { body.innerHTML = banner + '<button class="btn btn-gold" type="button" id="qbConnect">Connect QuickBooks</button><p class="muted small">You\'ll sign in to Blaine\'s QuickBooks and approve the connection once.</p>'; $('#qbConnect').onclick = function () { NG.api('qb-connect', {}).then(function (r) { location.href = r.url; }).catch(function (e) { NG.toast(e.message); }); }; return; }
      var L = st.lists || { items: [], taxCodes: [] };
      var opt = function (arr, sel) { return '<option value="">Choose...</option>' + arr.map(function (x) { return '<option value="' + NG.esc(x.id) + '"' + (x.id === sel ? ' selected' : '') + '>' + NG.esc(x.name) + (x.type ? ' (' + NG.esc(x.type) + ')' : '') + '</option>'; }).join(''); };
      body.innerHTML = banner + '<p>' + NG.pill('signed').replace('Signed', 'Connected') + ' ' + NG.esc(st.company || 'QuickBooks company') + '</p>' +
        (st.list_error ? '<p class="note">' + NG.esc(st.list_error) + '</p>' : '') +
        '<form id="qbForm" class="form grid2"><label>Product or service for website invoices<select name="item">' + opt(L.items, st.item_id) + '</select></label>' +
        '<label>Tax code<select name="tax">' + opt(L.taxCodes, st.tax_code_id) + '</select></label>' +
        '<div class="span2 formactions"><button class="btn btn-ink" type="submit">Save</button><button class="btn btn-line btn-sm" type="button" id="qbDisconnect">Disconnect</button><p class="formmsg"></p></div></form>' +
        '<p class="muted small">Used for both deposits and paid-in-full invoices. Ask Blaine\'s bookkeeper which item and tax code to use. If there isn\'t one yet, create a "Hot Tub Sale" service in QuickBooks, then refresh this page.</p>';
      $('#qbForm').onsubmit = function (e) {
        e.preventDefault(); var f = e.target, m = f.querySelector('.formmsg'); m.textContent = 'Saving...';
        NG.api('qb-settings', { item_id: f.item.value, tax_code_id: f.tax.value }).then(function () { m.textContent = 'Saved.'; }).catch(function (er) { m.textContent = er.message; });
      };
      $('#qbDisconnect').onclick = function () { NG.api('qb-settings', { disconnect: true }).then(loadQb); };
    }).catch(function (e) { body.innerHTML = '<p>' + NG.esc(e.message) + '</p>'; });
  }

  // ---------- Team ----------
  function loadTeam() {
    sb.from('profiles').select('full_name,email,role,active').in('role', ['admin', 'staff']).order('role').then(function (r) {
      $('#teamList').innerHTML = (r.data || []).map(function (p) {
        return '<li><b>' + NG.esc(p.full_name || p.email) + '</b><span>' + NG.esc(p.email) + ' · ' + (p.role === 'admin' ? 'Admin' : 'Salesperson') + (p.active ? '' : ' · inactive') + '</span></li>';
      }).join('') || '<li>No team members yet.</li>';
    });
  }
  $('#inviteForm').addEventListener('submit', function (e) {
    e.preventDefault();
    var f = e.target, m = f.querySelector('.formmsg');
    m.textContent = 'Sending invite...';
    NG.api('invite-staff', { full_name: f.full_name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim(), role: f.role.value })
      .then(function () { m.textContent = 'Invite sent.'; f.reset(); loadTeam(); }).catch(function (err) { m.textContent = err.message; });
  });


  // ---------- Profit and margin (admins only) ----------
  // Costs live in their own admin-only tables (sale_costs, product_costs), never on the sale itself,
  // so salespeople and customers can't read them.
  var COSTF = ['product_cost', 'sauna_cost', 'warehouse_shipping', 'delivery_cost', 'other_costs'];
  var costList = null;
  function getCostList() {
    if (costList) return Promise.resolve(costList);
    return sb.from('product_costs').select('id,product_type,model,cost,note').order('product_type').order('model').then(function (r) { costList = r.data || []; return costList; });
  }
  function revenueOf(s) { return num(s.hot_tub_value) + num(s.sauna_total) + num(s.delivery_fee); }
  function costOf(c) { return COSTF.reduce(function (t, k) { return t + num(c && c[k]); }, 0); }
  function pct(x) { return isFinite(x) ? (Math.round(x * 1000) / 10).toFixed(1) + '%' : '-'; }
  // Cost list entries for a model: an exact match, or its finish variants like "Cube 210 (Nero)".
  function matches(type, model) {
    var m = String(model || '').toLowerCase().trim(); if (!m || !costList) return [];
    var exact = costList.filter(function (c) { return c.product_type === type && c.model.toLowerCase() === m; });
    return exact.length ? exact : costList.filter(function (c) { return c.product_type === type && c.model.toLowerCase().indexOf(m + ' (') === 0; });
  }
  function hintFor(el, field, list) {
    el.innerHTML = list.length ? 'Cost list: ' + list.map(function (c) { return '<button type="button" data-f="' + field + '" data-v="' + c.cost + '">' + NG.esc(c.model) + ' ' + NG.money(c.cost) + '</button>'; }).join('') : 'Not on the cost list yet';
  }
  var pf = $('#profitForm');
  function profitSums() {
    if (!current) return;
    var c = {}; COSTF.forEach(function (k) { c[k] = num(pf[k].value); });
    var rev = revenueOf(current), cost = costOf(c), profit = rev - cost, m = rev ? profit / rev : NaN;
    $('#profitSums').innerHTML = [['Sale price before HST', NG.money(rev)], ['Our total cost', NG.money(cost)], ['Profit', NG.money(profit), profit >= 0 ? 'good' : 'bad'], ['Margin', pct(m), profit >= 0 ? 'good' : 'bad']]
      .map(function (r) { return '<div class="strong ' + (r[2] || '') + '"><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>'; }).join('');
  }
  function openProfit(sale) {
    var card = $('#profitCard');
    if (!sale || me.profile.role !== 'admin') { card.hidden = true; return; }
    card.hidden = false; $('#profitMsg').textContent = '';
    var sauna = sale.product_type === 'sauna';
    $('#pcLabel').textContent = (sauna ? 'Sauna cost with heater' : NG.cap(NG.noun(sale)) + ' cost') + ' (CAD)';
    $('#scWrap').hidden = sauna || !sale.sauna_model;
    Promise.all([getCostList(), sb.from('sale_costs').select('*').eq('sale_id', sale.id).maybeSingle()]).then(function (res) {
      var saved = res[1].data;
      var mainList = matches(sale.product_type || 'hot_tub', sauna ? sale.sauna_model : sale.tub_model);
      var addList = !sauna && sale.sauna_model ? matches('sauna', sale.sauna_model) : [];
      hintFor($('#pcHint'), 'product_cost', mainList); hintFor($('#scHint'), 'sauna_cost', addList);
      COSTF.forEach(function (k) { pf[k].value = saved && Number(saved[k]) ? saved[k] : ''; });
      pf.notes.value = (saved && saved.notes) || '';
      // First time: fill the cost from the list when there's exactly one match.
      if (!saved) {
        if (mainList.length === 1) pf.product_cost.value = mainList[0].cost;
        if (addList.length === 1) pf.sauna_cost.value = addList[0].cost;
        $('#profitMsg').textContent = mainList.length === 1 ? 'Cost filled in from the cost list. Add shipping and anything else, then save.' : '';
      }
      profitSums();
    });
  }
  pf.addEventListener('input', profitSums);
  pf.addEventListener('click', function (e) { var b = e.target.closest('button[data-f]'); if (!b) return; pf[b.dataset.f].value = b.dataset.v; profitSums(); });
  $('#profitSave').addEventListener('click', function () {
    var m = $('#profitMsg'); if (!current) return;
    var d = { sale_id: current.id, notes: pf.notes.value.trim() || null, updated_at: new Date().toISOString(), updated_by: me.user.id };
    COSTF.forEach(function (k) { d[k] = num(pf[k].value); });
    m.textContent = 'Saving...';
    sb.from('sale_costs').upsert(d, { onConflict: 'sale_id' }).then(function (r) { m.textContent = r.error ? r.error.message : 'Saved.'; if (!r.error) NG.toast('Costs saved'); });
  });
  function listProfits(rows) {
    var sold = rows.filter(function (s) { return SIGNED.indexOf(s.status) >= 0; });
    if (!sold.length) return;
    sb.from('sale_costs').select('*').in('sale_id', sold.map(function (s) { return s.id; })).then(function (r) {
      var by = {}; (r.data || []).forEach(function (c) { by[c.sale_id] = c; });
      sold.forEach(function (s) {
        var pc = $('[data-profit="' + s.id + '"]'), mc = $('[data-margin="' + s.id + '"]'); if (!pc) return;
        var c = by[s.id];
        if (!c) { pc.innerHTML = '<span class="muted small">Add costs</span>'; return; }
        var rev = revenueOf(s), profit = rev - costOf(c);
        pc.textContent = NG.money(profit); pc.className = 'num ' + (profit >= 0 ? 'pos' : 'neg');
        mc.textContent = rev ? pct(profit / rev) : '-';
      });
    });
  }

  // ---------- Cost list (Team tab, admins) ----------
  var CAT = { hot_tub: 'Hot tub', swim_spa: 'Swim spa', mini_pool: 'Mini pool', sauna: 'Sauna' };
  function loadCosts() {
    costList = null;
    getCostList().then(function (list) {
      $('#costRows').innerHTML = list.length ? list.map(function (c) {
        return '<tr data-cost="' + c.id + '"><td>' + CAT[c.product_type] + '</td><td>' + NG.esc(c.model) + '</td><td class="num"><input type="number" step="0.01" min="0" value="' + c.cost + '" aria-label="Cost of ' + NG.esc(c.model) + '"></td><td class="src">' + NG.esc(c.note || '') + '</td><td><button class="linkbtn" type="button" data-del="' + c.id + '">Remove</button></td></tr>';
      }).join('') : '<tr><td colspan="5" class="empty">No costs yet. Upload a spreadsheet to get started.</td></tr>';
    });
  }
  $('#costRows').addEventListener('change', function (e) {
    var tr = e.target.closest('tr[data-cost]'); if (!tr || !e.target.matches('input')) return;
    sb.from('product_costs').update({ cost: num(e.target.value), note: 'Edited in the portal', updated_at: new Date().toISOString(), updated_by: me.user.id }).eq('id', tr.dataset.cost)
      .then(function (r) { if (r.error) return NG.toast(r.error.message); NG.toast('Cost updated'); tr.querySelector('.src').textContent = 'Edited in the portal'; costList = null; });
  });
  $('#costRows').addEventListener('click', function (e) {
    var b = e.target.closest('[data-del]'); if (!b) return;
    if (b.dataset.confirm !== '1') { b.dataset.confirm = '1'; b.textContent = 'Tap again'; setTimeout(function () { b.dataset.confirm = ''; b.textContent = 'Remove'; }, 4000); return; }
    sb.from('product_costs').delete().eq('id', b.dataset.del).then(function (r) { if (r.error) return NG.toast(r.error.message); loadCosts(); });
  });
  $('#costDownload').addEventListener('click', function () {
    getCostList().then(function (list) {
      var csv = 'Category,Model,Cost (CAD),Source\n' + list.map(function (c) { return [CAT[c.product_type], c.model, c.cost, c.note || ''].map(function (v) { return '"' + String(v).replace(/"/g, '""') + '"'; }).join(','); }).join('\n');
      var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'north-grenville-cost-list.csv'; a.click();
    });
  });
  function loadXlsx() {
    if (window.XLSX) return Promise.resolve(window.XLSX);
    return new Promise(function (ok, fail) {
      var sc = document.createElement('script'); sc.src = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
      sc.onload = function () { ok(window.XLSX); }; sc.onerror = function () { fail(new Error("Couldn't load the spreadsheet reader. Check your connection and try again.")); };
      document.head.appendChild(sc);
    });
  }
  // Reads Platinum's price sheet as it comes, or any sheet with Model and Cost columns.
  function parseSheet(rows, sheetName, rate) {
    var out = [], hdr = -1, mCol = -1, cCol = -1, catCol = -1, usd = false, sect = null;
    var low = function (v) { return String(v == null ? '' : v).toLowerCase().replace(/\s+/g, ' ').trim(); };
    var catOf = function (t) { t = low(t); return /swim/.test(t) ? 'swim_spa' : /mini ?pool/.test(t) ? 'mini_pool' : /sauna|hekla/.test(t) ? 'sauna' : /hot ?tub|spa|deluxe|premium|luxury/.test(t) ? 'hot_tub' : null; };
    for (var i = 0; i < rows.length && hdr < 0; i++) {
      var r = rows[i] || [];
      for (var j = 0; j < r.length; j++) if (/^model/.test(low(r[j]))) { hdr = i; mCol = j; break; }
    }
    if (hdr < 0) return { error: 'No "Model" column found in ' + sheetName + '.' };
    var h = (rows[hdr] || []).map(low), pick = function (test) { for (var k = 0; k < h.length; k++) if (test(h[k])) return k; return -1; };
    cCol = pick(function (t) { return /(cdn|cad)/.test(t) && /landed/.test(t); });
    if (cCol < 0) cCol = pick(function (t) { return /(cdn|cad)/.test(t) && /cost/.test(t); });
    if (cCol < 0) { cCol = pick(function (t) { return /landed/.test(t) && /usd/.test(t); }); usd = cCol >= 0; }
    if (cCol < 0) { cCol = pick(function (t) { return /cost|trade|price/.test(t) && !/retail|sale|msrp|map/.test(t); }); usd = cCol >= 0 && /usd/.test(h[cCol]); }
    catCol = pick(function (t) { return /^(category|type|product)/.test(t); });
    if (cCol < 0) return { error: 'No cost column found in ' + sheetName + '.' };
    var sheetCat = catOf(sheetName);
    for (var n = hdr + 1; n < rows.length; n++) {
      var row = rows[n] || [], name = String(row[mCol] == null ? '' : row[mCol]).trim(), v = row[cCol];
      if (!name) continue;
      if ((v === '' || v == null) && row.filter(function (x) { return x !== '' && x != null; }).length === 1) { sect = catOf(name) || sect; continue; }
      var cost = typeof v === 'number' ? v : parseFloat(String(v).replace(/[$,\s]/g, ''));
      if (!isFinite(cost) || cost <= 0) continue;
      var model = name.replace(/\s+Professional\b/i, ' Pro').replace(/^Palmero$/i, 'Palermo');
      var cat = (catCol >= 0 && catOf(row[catCol])) || sect || sheetCat || 'hot_tub';
      out.push({ product_type: cat, model: model, cost: Math.round((usd ? cost * rate : cost) * 100) / 100,
        note: sheetName + ': ' + String(rows[hdr][cCol]).replace(/\s+/g, ' ').trim() + (usd ? ' x ' + rate : '') });
    }
    return { rows: out };
  }
  var pending = null;
  $('#costFile').addEventListener('change', function () {
    var f = this.files[0], m = $('#costMsg'); if (!f) return;
    var rate = num($('#costRate').value) || 1;
    m.textContent = 'Reading ' + f.name + '...';
    loadXlsx().then(function (X) { return f.arrayBuffer().then(function (buf) { return X.read(buf, { type: 'array' }); }); }).then(function (wb) {
      var all = [], errs = [];
      wb.SheetNames.forEach(function (sn) {
        var rows = window.XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1, raw: true, defval: '' });
        var p = parseSheet(rows, sn, rate); if (p.error) errs.push(p.error); else all = all.concat(p.rows);
      });
      $('#costFile').value = '';
      if (!all.length) { m.textContent = errs.join(' ') || 'No costs found in that file.'; return; }
      pending = all; m.textContent = '';
      var byCat = {}; all.forEach(function (r) { byCat[r.product_type] = (byCat[r.product_type] || 0) + 1; });
      $('#costPreview').innerHTML = '<div class="costpreview"><p><b>Found ' + all.length + ' costs</b> (' + Object.keys(byCat).map(function (k) { return byCat[k] + ' ' + CAT[k].toLowerCase() + (byCat[k] > 1 ? 's' : ''); }).join(', ') + ').</p>' +
        '<p class="muted small">' + all.slice(0, 6).map(function (r) { return NG.esc(r.model) + ' ' + NG.money(r.cost); }).join(', ') + (all.length > 6 ? ', ...' : '') + '</p>' +
        '<div class="formactions"><button class="btn btn-gold" type="button" id="costApply">Save these costs</button><button class="linkbtn" type="button" id="costCancel">Cancel</button></div></div>';
      $('#costApply').onclick = applyCosts; $('#costCancel').onclick = function () { pending = null; $('#costPreview').innerHTML = ''; };
    }).catch(function (err) { m.textContent = err.message; });
  });
  function applyCosts() {
    if (!pending) return;
    var m = $('#costMsg'), rows = pending; pending = null; $('#costPreview').innerHTML = ''; m.textContent = 'Saving...';
    costList = null;
    getCostList().then(function (list) {
      var key = function (t, mo) { return t + '|' + mo.toLowerCase(); }, have = {};
      list.forEach(function (c) { have[key(c.product_type, c.model)] = c.id; });
      var now = new Date().toISOString(), ins = [], ups = [];
      rows.forEach(function (r) {
        var d = { product_type: r.product_type, model: r.model, cost: r.cost, note: r.note, updated_at: now, updated_by: me.user.id };
        var id = have[key(r.product_type, r.model)];
        if (id) ups.push(sb.from('product_costs').update(d).eq('id', id)); else ins.push(d);
      });
      if (ins.length) ups.push(sb.from('product_costs').insert(ins));
      return Promise.all(ups).then(function (res) {
        var bad = res.filter(function (x) { return x.error; });
        m.textContent = bad.length ? bad[0].error.message : 'Saved ' + rows.length + ' costs (' + ins.length + ' new, ' + (rows.length - ins.length) + ' updated).';
        loadCosts();
      });
    });
  }

  // ---------- Start ----------
  NG.requireRole(['admin', 'staff']).then(function (m) {
    me = m;
    $('#whoami').textContent = me.profile.full_name || me.profile.email;
    if (me.profile.role === 'admin') $$('.admin-only').forEach(function (el) { el.hidden = false; });
    $('#signOut').addEventListener('click', NG.signOut);
    window.addEventListener('hashchange', route); route();
    // First time in: ask for a display name for agreements.
    if (!me.profile.full_name) {
      var n = document.createElement('div'); n.className = 'card namebox';
      n.innerHTML = '<form class="form"><label>Your full name, as it should appear on agreements<input name="n" required></label><button class="btn btn-gold" type="submit">Save</button></form>';
      $('.appmain .wrap').prepend(n);
      n.querySelector('form').addEventListener('submit', function (e) {
        e.preventDefault(); var v = e.target.n.value.trim(); if (!v) return;
        sb.from('profiles').update({ full_name: v }).eq('id', me.user.id).then(function () { me.profile.full_name = v; $('#whoami').textContent = v; n.remove(); NG.toast('Saved'); });
      });
    }
  });
})();
