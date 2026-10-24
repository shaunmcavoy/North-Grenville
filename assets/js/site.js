// Size filter on line pages
document.querySelectorAll('.filters').forEach(function (f) {
  f.addEventListener('click', function (e) {
    var c = e.target.closest('.chip'); if (!c) return;
    f.querySelectorAll('.chip').forEach(function (x) { x.setAttribute('aria-pressed', 'false'); });
    c.setAttribute('aria-pressed', 'true');
    var grid = f.closest('.pick').querySelector('.grid');
    grid.querySelectorAll('.tub').forEach(function (t) {
      var s = +t.dataset.s;
      t.hidden = c.dataset.f === 'small' ? s > 5 : c.dataset.f === 'large' ? s < 6 : false;
    });
  });
});
// Copy phone number
var toast = document.getElementById('toast');
function say(m) { if (!toast) return; toast.textContent = m; toast.hidden = false; clearTimeout(say.t); say.t = setTimeout(function () { toast.hidden = true; }, 1800); }
document.addEventListener('click', function (e) {
  var b = e.target.closest('[data-copy]'); if (!b) return;
  var v = b.dataset.copy;
  try { navigator.clipboard.writeText(v).then(function () { say('Number copied'); }, function () { say(v); }); } catch (err) { say(v); }
});
// Blog email sign-up
document.querySelectorAll('.subform').forEach(function (form) {
  var msg = form.querySelector('.submsg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var email = form.email.value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) { msg.textContent = 'Please enter a valid email address.'; form.email.focus(); return; }
    if (!form.consent.checked) { msg.textContent = 'Please tick the box so we have your permission to email you.'; return; }
    var btn = form.querySelector('button'); btn.disabled = true; msg.textContent = 'Signing you up...';
    fetch(form.dataset.endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email, first_name: form.first_name.value.trim(), consent: true, website: form.website.value, source: form.dataset.source })
    }).then(function (r) { return r.json().then(function (d) { return { ok: r.ok, d: d }; }); })
      .then(function (res) {
        if (res.ok && res.d.already) { msg.textContent = "You're already signed up. Thanks!"; form.reset(); }
        else if (res.ok) { msg.textContent = 'Almost done. Check your inbox and click the link to confirm.'; form.reset(); }
        else { msg.textContent = res.d.error || 'Something went wrong. Please try again.'; }
      })
      .catch(function () { msg.textContent = "We couldn't reach the server. Please try again in a minute."; })
      .finally(function () { btn.disabled = false; });
  });
});
// Messages after confirm / unsubscribe links
(function () {
  var note = document.querySelector('.subnote'); if (!note) return;
  var s = new URLSearchParams(location.search).get('subscribe');
  var text = { confirmed: "You're in. You'll get Blaine's next post by email.", unsubscribed: "You've been unsubscribed. You won't get any more blog emails.", invalid: "That link didn't work. It may be old. Try signing up again below." }[s];
  if (text) { note.textContent = text; note.hidden = false; }
})();

// Signed in? Turn the header's "Sign in" button into a shortcut to the right portal.
(function () {
  try {
    var raw = localStorage.getItem('sb-vpqbgsgrvapxwvstrpfs-auth-token');
    var role = localStorage.getItem('ng_role');
    if (!raw || !role) return;
    var tok = JSON.parse(raw);
    if (!tok || !tok.refresh_token) return; // the session can still be renewed while a refresh token exists
    var staff = role === 'admin' || role === 'staff';
    document.querySelectorAll('.top .signin').forEach(function (a) {
      a.href = staff ? '/staff/' : '/portal/';
      a.setAttribute('aria-label', staff ? 'Open the staff portal' : 'Open your portal');
      var l = a.querySelector('.lbl-signin'); if (l) l.textContent = staff ? 'Staff portal' : 'My portal';
    });
  } catch (e) { /* storage blocked or unreadable: keep the Sign in button */ }
})();

// Close the phone menu after a tap or a tap outside it
(function(){var m=document.querySelector('.mnav');if(!m)return;
m.addEventListener('click',function(e){if(e.target.closest('.mnav-panel a'))m.removeAttribute('open')});
document.addEventListener('click',function(e){if(m.open&&!m.contains(e.target))m.removeAttribute('open')});})();

// Let the site be saved to a phone's home screen and open like an app
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () { /* the site still works without it */ }); });
}

// Tell the Meta Pixel when someone taps to call or text Blaine (only runs when the Pixel is on the page)
document.addEventListener('click', function (e) {
  var a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="sms:"]');
  if (!a || typeof window.fbq !== 'function') return;
  window.fbq('track', 'Contact', { method: a.getAttribute('href').indexOf('sms:') === 0 ? 'text' : 'call' });
});
