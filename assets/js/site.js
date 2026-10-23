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
