(function () {
  var q = new URLSearchParams(location.search);
  var next = q.get('next') || '';
  function go(me) {
    var dest = next && next.charAt(0) === '/' ? next : (me && me.profile.role === 'customer' ? '/portal/' : '/staff/');
    if (me && me.profile.role === 'customer' && dest.indexOf('/staff') === 0) dest = '/portal/';
    location.replace(dest);
  }
  var th = q.get('token_hash');
  if (th) {
    document.getElementById('loginForm').hidden = true;
    document.getElementById('loginWorking').hidden = false;
    NG.sb.auth.verifyOtp({ token_hash: th, type: q.get('type') || 'magiclink' }).then(function (r) {
      if (r.error) {
        document.getElementById('loginWorking').innerHTML = '<p>That sign-in link has expired or was already used. Enter your email below for a fresh one.</p>';
        document.getElementById('loginForm').hidden = false;
        history.replaceState(null, '', '/login/' + (next ? '?next=' + encodeURIComponent(next) : ''));
        return;
      }
      NG.me().then(go);
    });
  } else {
    NG.me().then(function (me) { if (me) go(me); });
  }
  var form = document.getElementById('loginForm'), msg = form.querySelector('.formmsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.querySelector('#loginEmail').value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'Please enter a valid email address.'; return; }
    var b = form.querySelector('button'); b.disabled = true; msg.textContent = 'Sending...';
    NG.api('login-link', { email: email, next: next }).then(function () {
      msg.textContent = 'Check your email. If you have an account with us, your sign-in link is on its way. It expires in an hour.';
    }).catch(function (err) { msg.textContent = err.message; }).finally(function () { b.disabled = false; });
  });
})();
