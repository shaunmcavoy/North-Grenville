/* Shared code for the login, staff, signing and customer portal pages. */
(function () {
  var URL_ = 'https://vpqbgsgrvapxwvstrpfs.supabase.co';
  var KEY = 'sb_publishable_ga3P0FSU8iH8K5ZHcgJIgw_0dvqa6cH';
  var FN = URL_ + '/functions/v1/portal/';
  var sb = window.supabase.createClient(URL_, KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });

  var NG = window.NG = { sb: sb, FN: FN };

  NG.money = function (n) { return '$' + Number(n || 0).toLocaleString('en-CA', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); };
  NG.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  NG.date = function (d) { return d ? new Date(d).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' }) : ''; };
  NG.dateTime = function (d) { return d ? new Date(d).toLocaleString('en-CA', { dateStyle: 'medium', timeStyle: 'short' }) : ''; };

  // Call a portal route. Sends the signed-in user's token when there is one.
  NG.api = function (route, body, method) {
    return sb.auth.getSession().then(function (r) {
      var headers = { 'Content-Type': 'application/json' };
      var s = r.data && r.data.session;
      if (s) headers.Authorization = 'Bearer ' + s.access_token;
      var opts = { method: method || 'POST', headers: headers };
      if (body && (method || 'POST') !== 'GET') opts.body = JSON.stringify(body);
      return fetch(FN + route, opts).then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (d) {
          if (!res.ok) { var e = new Error(d.error || 'Something went wrong. Please try again.'); e.data = d; e.status = res.status; throw e; }
          return d;
        });
      });
    });
  };

  // Current user + profile, or null.
  NG.me = function () {
    return sb.auth.getSession().then(function (r) {
      var s = r.data && r.data.session;
      if (!s) return null;
      return sb.from('profiles').select('*').eq('id', s.user.id).maybeSingle().then(function (p) {
        return p.data ? { user: s.user, profile: p.data } : null;
      });
    });
  };

  NG.requireRole = function (roles) {
    return NG.me().then(function (me) {
      if (!me || roles.indexOf(me.profile.role) < 0) {
        location.replace('/login/?next=' + encodeURIComponent(location.pathname + location.hash));
        return new Promise(function () {});
      }
      return me;
    });
  };

  NG.signOut = function () { sb.auth.signOut().then(function () { location.href = '/login/'; }); };

  NG.toast = function (msg) {
    var t = document.getElementById('toast'); if (!t) return;
    t.textContent = msg; t.hidden = false; clearTimeout(NG.toast.t);
    NG.toast.t = setTimeout(function () { t.hidden = true; }, 2600);
  };

  NG.copy = function (text) {
    try { navigator.clipboard.writeText(text).then(function () { NG.toast('Copied'); }, function () { NG.toast(text); }); }
    catch (e) { NG.toast(text); }
  };

  // Signature pad on a <canvas>. Returns {isEmpty, clear, toDataURL}.
  NG.signaturePad = function (canvas) {
    var ctx = canvas.getContext('2d'), drawing = false, empty = true, last = null;
    function size() {
      var r = canvas.getBoundingClientRect(), d = window.devicePixelRatio || 1;
      var keep = empty ? null : canvas.toDataURL();
      canvas.width = Math.round(r.width * d); canvas.height = Math.round(r.height * d);
      ctx.setTransform(d, 0, 0, d, 0, 0);
      ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1d1611';
      if (keep) { var img = new Image(); img.onload = function () { ctx.drawImage(img, 0, 0, r.width, r.height); }; img.src = keep; }
    }
    function pt(e) { var r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    canvas.addEventListener('pointerdown', function (e) { drawing = true; last = pt(e); canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
    canvas.addEventListener('pointermove', function (e) {
      if (!drawing) return; var p = pt(e);
      ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; empty = false; e.preventDefault();
    });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { canvas.addEventListener(ev, function () { drawing = false; }); });
    window.addEventListener('resize', size); size();
    return {
      isEmpty: function () { return empty; },
      clear: function () { ctx.clearRect(0, 0, canvas.width, canvas.height); empty = true; },
      toDataURL: function () {
        // Export at a modest fixed size so the PNG stays small.
        var out = document.createElement('canvas'); out.width = 600; out.height = 200;
        out.getContext('2d').drawImage(canvas, 0, 0, 600, 200);
        return out.toDataURL('image/png');
      }
    };
  };

  NG.STATUS = {
    draft: ['Draft', 'grey'], awaiting_customer: ['Waiting for customer', 'amber'], signed: ['Signed', 'teal'],
    deposit_paid: ['Deposit received', 'teal'], delivery_scheduled: ['Delivery booked', 'gold'], delivered: ['Delivered', 'green'], cancelled: ['Cancelled', 'grey']
  };
  NG.pill = function (st) { var s = NG.STATUS[st] || [st, 'grey']; return '<span class="pill pill-' + s[1] + '">' + NG.esc(s[0]) + '</span>'; };

  // Match a model name like "Palma" to its photo and line.
  NG.tubFor = function (model) {
    var m = String(model || '').toLowerCase().replace(/hot tub/, '').trim();
    var list = window.NG_TUBS || [];
    for (var i = 0; i < list.length; i++) if (list[i].n.toLowerCase() === m) return list[i];
    return null;
  };
})();
