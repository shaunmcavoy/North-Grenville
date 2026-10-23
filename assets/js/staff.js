(function () {
  var sb = NG.sb, me = null, current = null, filter = 'open', pad = null;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var form = $('#saleForm');
  var CUST = ['name', 'email', 'cell', 'heard_about', 'address', 'city_pc'];
  var SALE = ['sale_date', 'tub_make', 'tub_model', 'est_delivery', 'shell_colour', 'siding', 'water_care', 'stereo', 'starter_kit', 'steps', 'lifter', 'spa_cover', 'other', 'sauna_make', 'sauna_model', 'sauna_electrical', 'notes'];
  var MONEY = ['hot_tub_value', 'sauna_total', 'delivery_fee', 'deposit'];
  var TAX = 0.13;

  // Model dropdown, grouped by line
  (function () {
    var sel = $('#tubModel'), tubs = window.NG_TUBS || [], lines = {};
    tubs.forEach(function (t) { (lines[t.lineName] = lines[t.lineName] || []).push(t); });
    var h = '<option value="">No hot tub</option>';
    Object.keys(lines).forEach(function (l) {
      h += '<optgroup label="' + NG.esc(l) + ' line">' + lines[l].map(function (t) { return '<option value="' + NG.esc(t.n) + '">' + NG.esc(t.n) + ' (seats ' + NG.esc(t.seats) + ')</option>'; }).join('') + '</optgroup>';
    });
    sel.innerHTML = h + '<option value="__other">Other model...</option>';
    sel.addEventListener('change', function () {
      if (sel.value === '__other') {
        var input = document.createElement('input'); input.name = 'tub_model'; input.placeholder = 'Model name';
        sel.replaceWith(input); input.focus();
      }
    });
  })();

  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function sums() {
    var tub = num(form.hot_tub_value.value), sauna = num(form.sauna_total.value), del = num(form.delivery_fee.value), dep = num(form.deposit.value);
    var sub = tub + sauna + del, tax = Math.round(sub * TAX * 100) / 100, tot = sub + tax;
    $('#sums').innerHTML = [['Products', tub + sauna], ['Delivery', del], ['Subtotal', sub], ['HST (13%)', tax], ['Total', tot, 1], ['Deposit', dep], ['Balance', tot - dep, 1]]
      .map(function (r) { return '<div' + (r[2] ? ' class="strong"' : '') + '><dt>' + r[0] + '</dt><dd>' + NG.money(r[1]) + '</dd></div>'; }).join('');
  }
  MONEY.forEach(function (k) { form[k].addEventListener('input', sums); });

  function show(view) {
    $$('.view').forEach(function (v) { v.hidden = v.id !== 'view-' + view; });
    $$('.tabs a').forEach(function (a) { a.removeAttribute('aria-current'); });
    var tab = view === 'sale' ? (current && current.id ? 'sales' : 'new') : view;
    var t = $('.tabs a[data-tab="' + tab + '"]'); if (t) t.setAttribute('aria-current', 'page');
    $('#staffTitle').textContent = { sales: 'Sales', sale: current && current.id ? 'Sale #' + current.number : 'New sale', team: 'Team' }[view] || 'Sales';
    window.scrollTo(0, 0);
  }

  function route() {
    var h = location.hash.slice(1) || 'sales';
    if (h === 'team' && me.profile.role === 'admin') { show('team'); loadTeam(); }
    else if (h === 'new') { openSale(null); }
    else if (h.indexOf('sale-') === 0) { openSale(h.slice(5)); }
    else { show('sales'); loadSales(); }
  }

  // ---------- List ----------
  function loadSales() {
    var q = sb.from('sales').select('id,number,status,total,tub_model,sauna_model,updated_at,salesperson_id,customers(name),profiles!sales_salesperson_id_fkey(full_name,email)').order('updated_at', { ascending: false }).limit(200);
    if (filter === 'open') q = q.in('status', ['draft', 'awaiting_customer', 'signed', 'deposit_paid', 'delivery_scheduled']);
    else if (filter !== 'all') q = q.eq('status', filter);
    q.then(function (r) {
      var rows = r.data || [], isAdmin = me.profile.role === 'admin';
      $('#saleRows').innerHTML = rows.length ? rows.map(function (s) {
        var what = [s.tub_model, s.sauna_model && s.sauna_model + ' sauna'].filter(Boolean).join(' + ') || '-';
        var rep = s.profiles ? (s.profiles.full_name || s.profiles.email) : '';
        return '<tr data-id="' + s.id + '" tabindex="0"><td>' + s.number + '</td><td>' + NG.esc(s.customers && s.customers.name) + '</td><td>' + NG.esc(what) + '</td><td class="num">' + NG.money(s.total) + '</td><td>' + NG.pill(s.status) + '</td>' + (isAdmin ? '<td>' + NG.esc(rep) + '</td>' : '') + '<td>' + NG.date(s.updated_at) + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="empty">No sales here yet. Start one with <a href="#new">New sale</a>.</td></tr>';
    });
  }
  $('#saleRows').addEventListener('click', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr) location.hash = 'sale-' + tr.dataset.id; });
  $('#saleRows').addEventListener('keydown', function (e) { var tr = e.target.closest('tr[data-id]'); if (tr && e.key === 'Enter') location.hash = 'sale-' + tr.dataset.id; });
  $$('.filters .chip').forEach(function (c) {
    c.addEventListener('click', function () {
      $$('.filters .chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); }); c.setAttribute('aria-pressed', 'true');
      filter = c.dataset.st; loadSales();
    });
  });

  // ---------- Editor ----------
  function setModel(v) {
    var el = form.querySelector('[name="tub_model"]');
    if (el.tagName === 'SELECT' && v && !$('option[value="' + CSS.escape(v) + '"]', el)) {
      var input = document.createElement('input'); input.name = 'tub_model'; el.replaceWith(input); el = input;
    }
    el.value = v || '';
  }
  function fill(s, c) {
    CUST.forEach(function (k) { form['c_' + k].value = (c && c[k]) || ''; });
    SALE.forEach(function (k) { if (k === 'tub_model') setModel(s && s.tub_model); else if (form[k]) form[k].value = (s && s[k] != null) ? s[k] : ''; });
    if (!s) { form.tub_make.value = 'Platinum Spas'; form.sale_date.value = new Date().toISOString().slice(0, 10); }
    MONEY.forEach(function (k) { form[k].value = s && Number(s[k]) ? s[k] : ''; });
    sums();
  }
  function lock(locked) {
    $$('input,select,textarea', form).forEach(function (el) { el.disabled = locked; });
    $('#saveBtn').hidden = locked; $('#deleteBtn').hidden = locked || !current || !current.id;
    $('#lockNote').hidden = !locked || (current && current.status !== 'awaiting_customer');
  }
  function openSale(id) {
    current = null; form.querySelector('.formmsg').textContent = '';
    ['#signPanel', '#waitPanel', '#donePanel', '#eventsPanel'].forEach(function (p) { $(p).hidden = true; });
    if (!id) {
      fill(null, null); lock(false); $('#saleHeading').textContent = 'New sale'; $('#saleStatus').innerHTML = ''; show('sale'); return;
    }
    sb.from('sales').select('*, customers(*)').eq('id', id).maybeSingle().then(function (r) {
      if (!r.data) { NG.toast("That sale wasn't found."); location.hash = 'sales'; return; }
      current = r.data; fill(current, current.customers);
      $('#saleHeading').textContent = 'Sale #' + current.number + ' · ' + (current.customers ? current.customers.name : '');
      $('#saleStatus').innerHTML = NG.pill(current.status);
      lock(current.status !== 'draft');
      if (current.status === 'draft') { $('#signPanel').hidden = false; $('#repName').textContent = me.profile.full_name || me.profile.email; if (!pad) pad = NG.signaturePad($('#repSig')); else pad.clear(); }
      if (current.status === 'awaiting_customer') {
        $('#waitPanel').hidden = false;
        var link = current.sign_token ? location.origin + '/sign/?t=' + current.sign_token : '';
        $('#signLink').value = link; $('#openSign').href = link || '#';
      }
      if (current.agreement_pdf_path) {
        $('#donePanel').hidden = false;
        $('#doneText').textContent = (current.customer_typed_name || 'The customer') + ' signed on ' + NG.dateTime(current.customer_signed_at) + '. They were emailed their copy, the pre-delivery guide, the owner\'s manual and a link to their portal.';
      }
      loadEvents(current.id);
      show('sale');
    });
  }
  function loadEvents(id) {
    sb.from('sale_events').select('at,kind,detail').eq('sale_id', id).order('at').then(function (r) {
      var L = { rep_signed: 'Signed by salesperson and sent for signature', link_emailed: 'Signing link emailed to customer', link_resent: 'New signing link created', customer_signed: 'Customer signed', welcome_sent: 'Welcome email sent with agreement, guide and manual', welcome_failed: 'Welcome email failed to send' };
      var ev = r.data || []; if (!ev.length) return;
      $('#events').innerHTML = ev.map(function (e) { return '<li><b>' + NG.esc(L[e.kind] || e.kind) + '</b><span>' + NG.dateTime(e.at) + '</span></li>'; }).join('');
      $('#eventsPanel').hidden = false;
    });
  }

  function collect() {
    var c = {}, s = {};
    CUST.forEach(function (k) { c[k] = form['c_' + k].value.trim() || null; });
    SALE.forEach(function (k) { var el = form.querySelector('[name="' + k + '"]'); if (el) s[k] = el.value.trim() || null; });
    if (s.tub_model === '__other') s.tub_model = null;
    var t = NG.tubFor(s.tub_model); s.tub_line = t ? t.lineName : null;
    MONEY.forEach(function (k) { s[k] = num(form[k].value); });
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
    NG.api('invite-staff', { full_name: f.full_name.value.trim(), email: f.email.value.trim(), phone: f.phone.value.trim() })
      .then(function () { m.textContent = 'Invite sent.'; f.reset(); loadTeam(); }).catch(function (err) { m.textContent = err.message; });
  });

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
