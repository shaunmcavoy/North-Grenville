// "Find your tub": a few friendly questions, then the visitor asks Blaine to call and book a visit.
// A suggested shortlist is worked out from the site's product data (window.NG_FIND) and sent to the team only.
// Visitors never see it: Blaine gives the recommendation himself, on the phone and at the warehouse.
(function () {
  var root = document.getElementById('finder'); if (!root) return;
  var D = window.NG_FIND || { tubs: [], swim: [], pools: [], saunas: [] };
  var LEAD_URL = 'https://vpqbgsgrvapxwvstrpfs.supabase.co/functions/v1/portal/lead';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };

  // Every question says why we're asking, so it's clearly for the visitor's benefit.
  var Q = [
    { id: 'kind', q: 'What are you dreaming about?', why: 'So we only show you things that fit what you have in mind.',
      opts: [['hot_tub', 'A hot tub'], ['swim_spa', 'A swim spa, to swim or exercise at home'], ['mini_pool', 'A mini pool, built into the backyard'], ['sauna', 'A sauna'], ['unsure', "I'm not sure yet. Help me decide"]] },
    { id: 'people', q: "Who'll be in it most of the time?", why: "A tub that's too small gets crowded, and one that's too big costs more to heat than it needs to.",
      opts: [['one', 'Mostly just me'], ['two', 'The two of us'], ['family', 'A family of three or four'], ['crowd', 'Five or more. We like company']] },
    { id: 'use', q: 'What will you use it for most?', why: 'Pick as many as you like. This is what decides the seats and the jets, more than anything else.', multi: true,
      opts: [['unwind', 'Unwinding after a long day'], ['muscles', 'Easing sore muscles'], ['family', 'Family time, no screens'], ['date', 'Date nights for two'], ['friends', 'Having friends over'], ['active', 'Staying active: swimming or exercise']] },
    { id: 'seat', q: 'How do you picture yourself sitting?', why: "There's no wrong answer. Some people love to stretch out; plenty prefer everyone sitting up face to face, which leaves more room for people.", skip: ['sauna'],
      opts: [['lounger', 'Stretched out on a lounger'], ['upright', 'Sitting up, face to face with everyone'], ['both', 'A bit of both'], ['any', "I don't mind"]] },
    { id: 'tier', q: 'Which sounds most like you?', why: 'We sell one hot tub brand, Platinum Spas, in three lines: good, better and best. When you buy something like a car or a TV, do you like the top-of-the-line package, something that simply gets the job done well, or a mix of both?', skip: ['sauna', 'swim_spa', 'mini_pool'],
      opts: [['best', 'I like the top-of-the-line package'], ['good', 'Something that does the job well, without the extras'], ['better', 'A mix: great quality where it counts']] },
    { id: 'place', q: 'Where are you picturing it?', why: 'Where it goes decides the size that fits, the base it needs and how we deliver it, so there are no surprises on delivery day.',
      opts: [['deck', 'On a deck'], ['patio', 'On a patio or concrete pad'], ['lawn', "On the lawn or gravel (we'll help with the base)"], ['indoor', 'Indoors, or in a covered space'], ['unsure', 'Not sure yet']] },
    { id: 'power', q: 'How would you like to power it?', why: "Some tubs plug into a regular outdoor outlet. Others need an electrician to run a dedicated line, which gives you more power and faster heating. Knowing now saves you a surprise later.", skip: ['sauna', 'swim_spa', 'mini_pool'],
      opts: [['plug', 'Plug into a regular outdoor outlet'], ['existing', 'I already have a line run, from an old hot tub'], ['wired', "I'm happy to have an electrician run a line"], ['unsure', 'Not sure']] },
    { id: 'line', q: 'What size is the breaker on that line?', showIf: function () { return A.power === 'existing'; }, other: 'other',
      why: "This helps Blaine check whether a new tub can run on the line you already have, which could save you a new electrical job. The number is printed on the hot tub's breaker switch in your electrical panel. If you're not sure, that's completely fine; just pick I don't know.",
      opts: [['40', '40 amp (most older tubs, usually 8 gauge wire)'], ['50', '50 amp (most newer tubs, usually 6 gauge wire)'], ['60', '60 amp'], ['other', "Something else (I'll type it)"], ['unknown', "I don't know"]] },
    { id: 'when', q: 'When would you love to be soaking?', why: "Your tub is ordered for you, not pulled off a lot, so this helps Blaine plan delivery around you. There's no pressure either way.",
      other: 'other', otherLabel: 'When are you thinking?', otherHint: 'e.g. before Christmas, in time for spring',
      opts: [['asap', 'As soon as possible'], ['weeks', 'In the next few weeks'], ['months', 'In the next few months'], ['other', "Something else (I'll type it)"]] }
  ];
  var A = {}, step = 0;
  var label = function (qid) { var q = Q.filter(function (x) { return x.id === qid; })[0]; var v = A[qid]; if (!q || v == null) return null;
    var pick = function (k) { var o = q.opts.filter(function (o) { return o[0] === k; })[0]; return o ? o[1] : k; };
    if (q.other && v === q.other) return 'Something else: ' + (A[qid + '_text'] || 'not given');
    return Array.isArray(v) ? v.map(pick).join(', ') : pick(v); };
  var visible = function () { return Q.filter(function (q) { return !(q.skip && q.skip.indexOf(A.kind) >= 0) && (!q.showIf || q.showIf()); }); };

  function render() {
    var qs = visible();
    if (step >= qs.length) return results();
    var q = qs[step], cur = A[q.id];
    root.innerHTML = '<div class="fprog" aria-hidden="true"><span style="width:' + Math.round(step / qs.length * 100) + '%"></span></div>' +
      '<p class="fstep">Question ' + (step + 1) + ' of ' + qs.length + '</p>' +
      '<h2 class="fq">' + esc(q.q) + '</h2><p class="fwhy">' + esc(q.why) + '</p>' +
      '<div class="fopts" role="group" aria-label="' + esc(q.q) + '">' + q.opts.map(function (o) {
        var on = q.multi ? (cur || []).indexOf(o[0]) >= 0 : cur === o[0];
        return '<button type="button" class="fopt" data-v="' + o[0] + '" aria-pressed="' + on + '">' + esc(o[1]) + '</button>';
      }).join('') + '</div>' +
      (q.other && cur === q.other ? '<label class="fother">' + esc(q.otherLabel || 'Tell us what you know (breaker size, wire, anything)') + '<input id="fotherIn" maxlength="120" value="' + esc(A[q.id + '_text'] || '') + '" placeholder="' + esc(q.otherHint || 'e.g. 40 amp, not sure of the wire') + '"></label>' : '') +
      '<div class="fnav">' + (step ? '<button type="button" class="btn btn-line" data-back>Back</button>' : '<span></span>') +
      (q.multi ? '<button type="button" class="btn btn-ink" data-next' + ((cur || []).length ? '' : ' disabled') + '>Next</button>' : '') +
      (q.other && cur === q.other ? '<button type="button" class="btn btn-ink" data-next>Next</button>' : '') + '</div>';
    var oi = root.querySelector('#fotherIn'); if (oi) { oi.focus(); oi.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); A[q.id + '_text'] = oi.value.trim(); step++; render(); scrollTop(); } }); return; }
    var h = root.querySelector('.fq'); if (h && step) h.setAttribute('tabindex', '-1'), h.focus({ preventScroll: true });
  }
  root.addEventListener('click', function (e) {
    var qs = visible(), q = qs[step];
    var o = e.target.closest('.fopt');
    if (o && q) {
      if (q.multi) { var v = A[q.id] || []; var i = v.indexOf(o.dataset.v); if (i >= 0) v.splice(i, 1); else v.push(o.dataset.v); A[q.id] = v; render(); }
      else if (q.other && o.dataset.v === q.other) { A[q.id] = q.other; render(); }
      else { A[q.id] = o.dataset.v; step++; render(); scrollTop(); }
      return;
    }
    if (e.target.closest('[data-next]')) { var oi = root.querySelector('#fotherIn'); if (oi && q) A[q.id + '_text'] = oi.value.trim(); step++; render(); scrollTop(); return; }
    if (e.target.closest('[data-back]')) { step = Math.max(0, step - 1); render(); scrollTop(); return; }
    if (e.target.closest('[data-restart]')) { A = {}; step = 0; render(); scrollTop(); }
  });
  function scrollTop() { var t = root.getBoundingClientRect().top + window.scrollY - 90; if (window.scrollY > t) window.scrollTo({ top: t, behavior: 'smooth' }); }

  // ---------- Matching ----------
  function tubMatches() {
    var size = { one: [2, 5], two: [2, 6], family: [4, 7], crowd: [6, 9] }[A.people] || [2, 9];
    var uses = A.use || [];
    return D.tubs.map(function (t) {
      var seats = t.seats + t.loungers, score = 0, why = [];
      if (seats >= size[0] && seats <= size[1]) { score += 4; why.push('Room for ' + ({ one: 'you, with space for a guest', two: 'the two of you', family: 'the whole family', crowd: 'a full tub of people' }[A.people] || 'your group')); }
      else if (seats < size[0]) score -= 6;
      if (A.seat === 'lounger' && t.loungers) { score += 3; why.push(t.loungers > 1 ? 'Two loungers to stretch out on' : 'A full lounger to stretch out on'); }
      if (A.seat === 'upright' && !t.loungers) { score += 3; why.push('Everyone sits up, face to face'); }
      if (A.seat === 'both' && t.loungers === 1) { score += 2; why.push('A lounger plus plenty of seats'); }
      var tier = { best: 'luxury', good: 'deluxe', better: 'premium' }[A.tier];
      if (tier && t.line === tier) { score += 4; why.push(t.lineName + ' line: ' + { luxury: 'the cleanest water we sell, with the least work', deluxe: 'great value that does the job well', premium: 'great quality where it counts' }[tier]); }
      else if (tier === 'luxury' && t.line === 'premium') score += 1;
      else if (tier === 'deluxe' && t.line === 'premium') score += 1;
      if (A.power === 'plug' && t.plug) { score += 4; why.push('Plugs into a regular outdoor outlet'); }
      if (A.power === 'existing' && !t.plug) score += 1;
      if (A.power === 'plug' && !t.plug) score -= 3;
      if (uses.indexOf('muscles') >= 0 && t.jets >= 60) { score += 2; why.push(t.jets + ' jets for deeper massage'); }
      if (uses.indexOf('friends') >= 0 && seats >= 6) score += 2;
      if (uses.indexOf('family') >= 0 && seats >= 5) score += 1;
      if (uses.indexOf('date') >= 0 && t.loungers) score += 1;
      if (A.place === 'deck' && t.w <= 84) { score += 1; why.push('A compact footprint that suits a deck'); }
      return { name: 'The ' + t.n, url: '/' + t.line + '/' + t.k + '/', img: t.k, why: why.slice(0, 3), score: score, sub: t.lineName + ' line · ' + t.people + ' people · ' + t.jets + ' jets' };
    }).sort(function (a, b) { return b.score - a.score; }).slice(0, 3);
  }
  function listMatches(list, base, pickFn) {
    return list.filter(pickFn).slice(0, 3).map(function (m) { return { name: 'The ' + m.n, url: base + m.k + '/', img: m.img, why: m.why ? [m.why] : [], sub: m.sub }; });
  }
  function matches() {
    var k = A.kind, uses = A.use || [], small = A.people === 'one' || A.people === 'two';
    if (k === 'swim_spa' || (k === 'unsure' && uses.indexOf('active') >= 0)) {
      var s = listMatches(D.swim, '/swim-spas/', function (m) { return small ? m.len <= 200 : m.len > 200; });
      return { title: 'Swim spas to look at', intro: 'You mentioned staying active, so a swim spa might be the one: a current to swim against at one end and hot tub seats at the other, used 12 months a year.', items: s.length ? s : listMatches(D.swim, '/swim-spas/', function () { return true; }), more: ['/swim-spas/', 'See all swim spas'] };
    }
    if (k === 'mini_pool') return { title: 'Mini pools to look at', intro: 'A mini pool is built right into your backyard, with no siding, so it looks like it was always part of the yard.', items: listMatches(D.pools, '/mini-pools/', function () { return true; }), more: ['/mini-pools/', 'See all mini pools'] };
    if (k === 'sauna') {
      var indoor = A.place === 'indoor';
      return { title: indoor ? 'Indoor saunas to look at' : 'Outdoor saunas to look at', intro: indoor ? 'For inside the house, you can choose traditional heat or gentler infrared.' : 'Our outdoor saunas are all traditional, with real heat and steam, built to use right through the winter.',
        items: listMatches(D.saunas, '/saunas/', function (m) { return indoor ? m.where === 'Indoor' : m.where === 'Outdoor'; }), more: ['/saunas/', 'See all saunas'] };
    }
    return { title: 'Where I would start', intro: 'Based on your answers, these are the hot tubs I would show you first. Tap one to see why people choose it and my honest take.', items: tubMatches(), more: ['/#lines', 'See all three hot tub lines'] };
  }

  // ---------- Contact: book a time with Blaine ----------
  function results() {
    var r = matches();
    root.innerHTML = '<div class="fprog done" aria-hidden="true"><span style="width:100%"></span></div>' +
      '<form class="fcontact first" id="fcontact" novalidate>' +
        '<p class="fstep">Last step</p>' +
        '<h2 class="fq">Thanks. Now let\'s find a time to talk.</h2>' +
        '<p class="fwhy">Blaine will look over your answers himself, then give you a call to talk them through and book a time for you to come by the warehouse and sit in the tubs that fit. Sitting in a tub is the only real way to know if it\'s right, and he\'d rather you see it for yourself than take a website\'s word for it. No pressure, no obligation.</p>' +
        '<div class="fgrid">' +
          '<label>Your name<input name="name" autocomplete="name" required></label>' +
          '<label>Cell<input name="cell" type="tel" autocomplete="tel" required></label>' +
          '<label>Email<input name="email" type="email" autocomplete="email" required></label>' +
          '<label>Where do you live?<input name="city" autocomplete="address-level2" placeholder="Kemptville, Oxford Mills..."></label>' +
          '<label>Best time for Blaine to call<select name="best_time"><option>Weekday mornings</option><option>Weekday afternoons</option><option selected>Weekday evenings</option><option>Weekends</option><option>Any time</option></select></label>' +
          '<label>If he misses you<select name="contact_by"><option>Leave a message or try again</option><option>Send me a text</option><option>Send me an email</option></select></label>' +
        '</div>' +
        '<label class="fcheck"><input type="checkbox" name="consent" required> Yes, Blaine can call me about my plans, and follow up by text or email.</label>' +
        '<label class="fcheck"><input type="checkbox" name="blog"> Also send me Blaine\'s weekly blog: honest, simple hot tub advice. I can unsubscribe any time.</label>' +
        '<input class="hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<div class="fnav"><button type="button" class="btn btn-line" data-back>Back</button><button class="btn btn-gold" type="submit">Have Blaine call me</button></div>' +
        '<p class="formmsg" role="status" aria-live="polite"></p>' +
      '</form>';
    $('#fcontact').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, m = f.querySelector('.formmsg');
      if (!f.name.value.trim()) { m.textContent = 'Please add your name.'; f.name.focus(); return; }
      if (f.cell.value.replace(/\D/g, '').length < 10) { m.textContent = 'Please add your cell number so Blaine can call you.'; f.cell.focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.value.trim())) { m.textContent = 'Please check your email address.'; f.email.focus(); return; }
      if (!f.consent.checked) { m.textContent = 'Please tick the first box so Blaine can call you.'; return; }
      var answers = visible().map(function (q) { return { q: q.q, a: label(q.id) }; }).filter(function (x) { return x.a; });
      var btn = f.querySelector('button[type=submit]'); btn.disabled = true; m.textContent = 'Sending...';
      fetch(LEAD_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
        name: f.name.value, email: f.email.value, cell: f.cell.value, city: f.city.value, contact_by: 'Phone call. If missed: ' + f.contact_by.value, best_time: f.best_time.value,
        consent: f.consent.checked, blog: f.blog.checked, website: f.website.value, answers: answers,
        recommended: r.items.map(function (x) { return { name: x.name, url: x.url, why: x.why.join('. ') }; })
      }) }).then(function (res) { return res.json().then(function (d) { return { ok: res.ok, d: d }; }); }).then(function (res) {
        if (!res.ok) throw new Error(res.d.error || 'Something went wrong.');
        if (typeof window.fbq === 'function') window.fbq('track', 'Lead', { content_name: 'Find your tub' });
        var when = /any/i.test(f.best_time.value) ? 'soon' : f.best_time.value.toLowerCase();
        root.innerHTML = '<div class="fdone"><p class="fstep">All set</p><h2 class="fq">Thanks, ' + esc(f.name.value.trim().split(/\s+/)[0]) + '. Blaine will call you ' + esc(when) + '.</h2>' +
          '<p class="fwhy">He\'ll talk through your answers with you and set up a time to come see the tubs in person. We\'ve emailed you a note so you know who\'s calling' + (f.blog.checked ? ', plus a link to confirm the weekly blog' : '') + '. Can\'t wait? Call or text him any time at (613) 292-1786.</p></div>';
      }).catch(function (err) { m.textContent = err.message + ' You can also call or text Blaine at (613) 292-1786.'; btn.disabled = false; });
    });
  }
  render();
})();
