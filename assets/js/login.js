(function () {
  var $ = function (s) { return document.querySelector(s); };
  var q = new URLSearchParams(location.search);
  var next = q.get('next') || '';
  var setMode = q.get('setpw') === '1';
  var SET_NEXT = '/login/?setpw=1';
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

  function go(me) {
    var dest = next && next.charAt(0) === '/' ? next : (me && me.profile.role === 'customer' ? '/portal/' : '/staff/');
    if (me && me.profile.role === 'customer' && dest.indexOf('/staff') === 0) dest = '/portal/';
    location.replace(dest);
  }
  function showSetPassword(me) {
    $('#loginForm').hidden = true; $('#loginWorking').hidden = true; $('#setPassForm').hidden = false;
    $('#loginTitle').textContent = 'Choose a password';
    $('#loginLead').textContent = 'From now on you can sign in with your email and this password. No waiting for an email.';
    $('#setPassUser').value = (me && me.profile.email) || '';
    $('#newPass').focus();
  }

  // Arriving from an emailed link
  var th = q.get('token_hash');
  if (th) {
    $('#loginForm').hidden = true; $('#loginWorking').hidden = false;
    NG.sb.auth.verifyOtp({ token_hash: th, type: q.get('type') || 'magiclink' }).then(function (r) {
      if (r.error) {
        $('#loginWorking').innerHTML = '<p>That link has expired or was already used. Sign in with your password, or ask for a fresh link below.</p>';
        $('#loginForm').hidden = false;
        history.replaceState(null, '', '/login/' + (next ? '?next=' + encodeURIComponent(next) : ''));
        return;
      }
      NG.me().then(function (me) { if (setMode || next === SET_NEXT) showSetPassword(me); else go(me); });
    });
  } else {
    NG.me().then(function (me) {
      if (!me) return;
      if (setMode) showSetPassword(me); else go(me);
    });
  }

  // Sign in with email and password
  var form = $('#loginForm'), msg = form.querySelector('.formmsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('#loginEmail').value.trim(), pass = $('#loginPass').value;
    if (!EMAIL_RE.test(email)) { msg.textContent = 'Please enter a valid email address.'; return; }
    if (!pass) { msg.textContent = 'Please enter your password, or use the email link below.'; return; }
    var b = form.querySelector('button[type=submit]'); b.disabled = true; msg.textContent = 'Signing in...';
    NG.sb.auth.signInWithPassword({ email: email, password: pass }).then(function (r) {
      if (r.error) {
        msg.textContent = /invalid/i.test(r.error.message)
          ? "That email and password don't match. If you haven't set a password yet, use the link below."
          : r.error.message;
        return;
      }
      return NG.me().then(go);
    }).finally(function () { b.disabled = false; });
  });

  // Email links: one to set a password, one to just sign in
  function sendLink(dest, btn, done) {
    var email = $('#loginEmail').value.trim();
    if (!EMAIL_RE.test(email)) { msg.textContent = 'Enter your email above first.'; $('#loginEmail').focus(); return; }
    btn.disabled = true; msg.textContent = 'Sending...';
    NG.api('login-link', { email: email, next: dest }).then(function () { msg.textContent = done; })
      .catch(function (err) { msg.textContent = err.message; }).finally(function () { btn.disabled = false; });
  }
  $('#setPassLink').addEventListener('click', function () {
    sendLink(SET_NEXT, this, 'Check your email. If you have an account with us, a link is on its way. Tap it to choose your password. It works for an hour.');
  });
  $('#magicLink').addEventListener('click', function () {
    sendLink(next, this, 'Check your email. If you have an account with us, your sign-in link is on its way. It expires in an hour.');
  });

  // Save a new password
  var sf = $('#setPassForm'), smsg = sf.querySelector('.formmsg');
  sf.addEventListener('submit', function (e) {
    e.preventDefault();
    var p1 = $('#newPass').value, p2 = $('#newPass2').value;
    if (p1.length < 8) { smsg.textContent = 'Please use at least 8 characters.'; return; }
    if (p1 !== p2) { smsg.textContent = "Those two don't match. Please type it again."; return; }
    var b = sf.querySelector('button'); b.disabled = true; smsg.textContent = 'Saving...';
    NG.sb.auth.updateUser({ password: p1 }).then(function (r) {
      if (r.error) { smsg.textContent = /weak|short|pwned|leaked/i.test(r.error.message) ? 'Please choose a stronger password.' : r.error.message; b.disabled = false; return; }
      smsg.textContent = 'Saved. Taking you in...';
      next = '';
      NG.me().then(go);
    });
  });
})();
