#!/usr/bin/env python3
"""Builds the North Grenville Hot Tubs site.

Edit the content in src/ (data.json for tubs and lines, the .html partials
for page sections), then run:  python3 build.py
It writes index.html, deluxe/, premium/, luxury/, 404.html and sitemap.xml.
"""
import json, re, html
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).parent
SRC = ROOT / "src"
D = json.loads((SRC / "data.json").read_text())
SITE, LINES, TUBS = D["site"], D["lines"], D["tubs"]
SPECS = json.loads((SRC / "specs.json").read_text())     # Platinum Spas model specs
COPY = json.loads((SRC / "tubs_copy.json").read_text())  # Blaine's words for each tub page

PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>'
CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
TEL = f"tel:{SITE['phone_tel']}"
OCARE = SITE["ocare_url"]  # O-CareComfort sign-up, registered to Blaine as the sales advisor
OCARE_A = f'<a class="oclink" href="{OCARE}" target="_blank" rel="noopener">'


def ocl(html):
    """Links the first mention of O-Care to Blaine's O-Care registration page."""
    return html.replace("O-Care", OCARE_A + "O-Care</a>", 1)
esc = html.escape


def sms(text):
    return esc(f"sms:{SITE['phone_tel']}?&body={quote(text)}")


def fill(s, base):
    s = s.replace("{{PHONE}}", PHONE).replace("{{CHAT}}", CHAT).replace("{{BASE}}", base).replace("{{OCARE}}", OCARE)
    s = s.replace("{{IMG:brandLogo}}", f"{base}assets/img/logo.webp")
    return re.sub(r"\{\{IMG:([\w-]+)\}\}", lambda m: f"{base}assets/img/{m.group(1)}.webp", s)


def ver(url):
    """Adds a content fingerprint to our own CSS/JS so browsers always load the latest copy."""
    import hashlib
    if url.startswith("http"):
        return url
    rel = url.split("assets/", 1)[-1]
    f = ROOT / "assets" / rel
    if not f.exists():
        return url
    return f"{url}?v={hashlib.sha1(f.read_bytes()).hexdigest()[:10]}"


def page(path, title, desc, body, base, extra_head="", scripts=(), app="manifest", app_title="NG Hot Tubs"):
    canonical = SITE["url"] + "/" + path
    head = f"""<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}">
<link rel="canonical" href="{canonical}">
<meta property="og:type" content="website">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="{canonical}">
<meta property="og:image" content="{SITE['url']}/assets/img/og.jpg">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#1d1611">
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" type="image/png" sizes="32x32" href="/favicon-32.png">
<link rel="icon" type="image/png" sizes="96x96" href="/favicon.png">
<link rel="icon" type="image/png" sizes="192x192" href="/assets/icons/favicon-192.png">
<link rel="apple-touch-icon" href="{base}apple-touch-icon.png">
<link rel="manifest" href="/{app}.webmanifest">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black">
<meta name="apple-mobile-web-app-title" content="{app_title}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Figtree:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="{ver(base + "assets/css/site.css")}">
{extra_head}</head>
<body>
"""
    header = fill((SRC / "header.html").read_text(), base)
    footer = fill((SRC / "footer.html").read_text(), base)
    tail = f'\n<script src="{ver(base + "assets/js/site.js")}" defer></script>\n' + "".join(f'<script src="{ver(x)}"></script>\n' for x in scripts)
    out = head + header + '\n<main id="top">\n' + body + "\n</main>\n" + footer + tail + '</body>\n</html>\n'
    target = ROOT / path / "index.html" if path and not path.endswith(".html") else ROOT / (path or "index.html")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(out)
    assert "{{" not in out, f"unfilled token in {target}"
    return target


def card(t, base):
    flag = f'<span class="flag">{esc(t["flag"])}</span>' if t.get("flag") else ""
    return f"""<article class="tub" data-s="{t['s']}">
      <a class="ph" href="{base}{t['line']}/{t['k']}/" aria-label="See the {esc(t['n'])} in detail"><img src="{base}assets/img/{t['k']}.webp" alt="{esc(t['n'])} hot tub seen from above" loading="lazy" width="560" height="560">{flag}</a>
      <div class="bd">
        <h3 class="tubname"><a href="{base}{t['line']}/{t['k']}/">The {esc(t['n'])}</a></h3>
        <div class="specs"><div><b>{t['seats']}</b><span>Seats</span></div><div><b>{t['jets']}</b><span>Jets</span></div><div><b>{t['power']}</b><span>Power</span></div></div>
        <p class="note">{esc(t['note'])}</p>
        <a class="tubmore" href="{base}{t['line']}/{t['k']}/">See the details <span aria-hidden="true">&rarr;</span></a>
        <div class="acts">
          <a class="btn btn-ink" href="{sms(f"Hi Blaine, I'm interested in the {t['n']} hot tub. What's your best price?")}">Text Blaine for price</a>
          <a class="btn btn-line" href="{TEL}" aria-label="Call Blaine about the {esc(t['n'])}">Call</a>
        </div>
      </div>
    </article>"""


def line_body(lid, base):
    L = LINES[lid]
    tubs = [t for t in TUBS if t["line"] == lid]
    others = [k for k in LINES if k != lid]
    moments = "".join(f"<article><h3>{esc(a)}</h3><p>{ocl(esc(b))}</p></article>" for a, b in L["moments"])
    feats = "".join(f"<li>{esc(f)}</li>" for f in L["features"])
    cards = "\n    ".join(card(t, base) for t in tubs)
    other = "".join(f'<a href="{base}{o}/"><span>The {LINES[o]["name"]} line</span><b>{esc(LINES[o]["title"])}</b><em>See it &rarr;</em></a>' for o in others)
    n = L["name"]
    return f"""<section class="lhero">
  <div class="wrap">
    <a class="back" href="{base}#lines">&larr; All hot tub lines</a>
    <div class="lgrid">
      <div>
        <p class="eyebrow">The {n} line &middot; {len(tubs)} models</p>
        <h1>{esc(L['title'])}</h1>
        <blockquote class="belief"><p>{esc(L['believe'])}</p><footer><img src="{base}assets/img/logo.webp" alt="" width="40" height="40"><span><b>{SITE['owner']}</b><br>Owner, North Grenville Hot Tubs</span></footer></blockquote>
        <div class="ctas">
          <a class="btn btn-gold" href="#pick">Find your {n} tub</a>
          <a class="btn btn-ghost" href="{sms(f"Hi Blaine, I'm looking at the {n} line. Can you help me pick?")}">{CHAT}Text Blaine</a>
        </div>
      </div>
      <img class="lphoto" src="{base}assets/img/{L['hero']}.webp" alt="{n} line hot tub seen from above" width="560" height="560">
    </div>
  </div>
</section>
<section class="moments">
  <div class="wrap">
    <p class="eyebrow teal">Picture it in your backyard</p>
    <h2>What owning a {n} tub feels like.</h2>
    <div class="mgrid">{moments}</div>
  </div>
</section>
<section class="pick" id="pick">
  <div class="wrap">
    <div class="pickhead">
      <div>
        <p class="eyebrow teal">Step 1 &middot; Choose yours</p>
        <h2>Which {n} tub is yours?</h2>
        <p class="intro">Start with how many people will soak with you most nights.</p>
      </div>
      <div class="filters" role="group" aria-label="Filter by size">
        <button class="chip" type="button" data-f="all" aria-pressed="true">Everyone</button>
        <button class="chip" type="button" data-f="small" aria-pressed="false">Up to 5 people</button>
        <button class="chip" type="button" data-f="large" aria-pressed="false">6 or more</button>
      </div>
    </div>
    <div class="grid">
    {cards}
    </div>
  </div>
</section>
<section class="inc">
  <div class="wrap">
    <div>
      <p class="eyebrow teal">In every {n} tub</p>
      <h2>What comes with yours.</h2>
    </div>
    <ul>{feats}</ul>
  </div>
</section>
<section class="next">
  <div class="wrap">
    <p class="eyebrow">Step 2 &middot; Make it yours</p>
    <h2>What happens after you text Blaine.</h2>
    <ol>
      <li><b>He answers you himself</b><p>Your price, your questions, and an honest read on whether this is the right tub for you.</p></li>
      <li><b>You sit in it</b><p>Come to the warehouse at {SITE['street']} by appointment and try the seats.</p></li>
      <li><b>Your tub is ordered</b><p>Built to your colour and spec through Platinum Spas, then delivered to your yard.</p></li>
      <li><b>First soak, clean water</b><p>We set you up with O-Care and a weekly routine that takes minutes. {OCARE_A}Register your O-Care with Blaine</a> and it comes to your door, so you never run out.</p></li>
    </ol>
    <p class="help">{esc(L['help'])}</p>
    <div class="ctas">
      <a class="btn btn-gold" href="{TEL}">{PHONE}Call Blaine</a>
      <a class="btn btn-ghost" href="{sms(f"Hi Blaine, I'm interested in the {n} line.")}">{CHAT}Text Blaine for price</a>
    </div>
    <p class="num">{SITE['phone_display']}</p>
  </div>
</section>
<section class="others">
  <div class="wrap">
    <p class="eyebrow teal">Still deciding?</p>
    <div class="ogrid">{other}</div>
  </div>
</section>"""


def ftin(i):
    f, r = divmod(int(i), 12)
    return f"{f} ft {r} in" if r else f"{f} ft"


def sib_card(x, base):
    return f"""<a class="sib" href="{base}{x['line']}/{x['k']}/"><img src="{base}assets/img/{x['k']}.webp" alt="" loading="lazy" width="160" height="160"><span><b>The {esc(x['n'])}</b><small>Seats {x['seats']} &middot; {x['jets']} jets</small><em>{esc(COPY[x['k']]['head'])}</em></span></a>"""


def tub_body(t, base):
    """The detail page for one hot tub: why people buy it, who it's for, how it's built."""
    k, L, sp, cp = t["k"], LINES[t["line"]], SPECS[t["k"]], COPY[t["k"]]
    n, ln = t["n"], L["name"]
    w, d, h = sp["dims"]
    size = f"{ftin(w)} x {ftin(d)}" if w != d else f"{ftin(w)} square"
    lounge = sp["loungers"]
    layout = f"{sp['seats']} seat{'s' if sp['seats'] != 1 else ''}" + (f" and {lounge} lounger{'s' if lounge > 1 else ''}" if lounge else ", all upright")
    chips = [f"Seats {t['seats']}", f"{t['jets']} jets", size, "Plugs into 120V" if t["power"] == "120V" else f"{t['power']} / 240V"]
    chip_html = "".join(f"<li>{esc(c)}</li>" for c in chips)
    perfect = "".join(f"<li>{esc(x)}</li>" for x in cp["perfect"])
    rows = [
        ("Seating", f"{layout}, for {sp['people']} people"),
        ("Jets", f"{t['jets']}" + (f": {sp['jetmix']}" if sp.get("jetmix") else "")),
        ("Size", f"{w} x {d} in, {h} in tall ({size}, about {round(w * 2.54)} x {round(d * 2.54)} cm)"),
        ("Water", f"{sp['gal']:g} gallons"),
        ("Weight", f"{sp['dry']:,} lb empty, {sp['wet']:,} lb filled"),
        ("Pumps", sp["pumps"]),
        ("Heater", sp["heater"]),
        ("Power", sp["power"]),
        ("Controls", sp["controls"]),
        ("Shell colours", ", ".join(sp["colours"])),
    ]
    spec_html = "".join(f"<div><dt>{esc(a)}</dt><dd>{esc(b)}</dd></div>" for a, b in rows)
    # Line-wide features, minus the ones that only describe some models in the line.
    line_feats = [f for f in L["features"] if not re.search(r"Up to|Loungers or|3 to 7|plug-and-play on|seats and loungers", f)]
    if t["power"] == "120V":
        line_feats.append("120V plug-and-play, convertible to 240V")
    feats = "".join(f"<li>{esc(f)}</li>" for f in list(sp.get("extra", [])) + line_feats)
    sib_html = "".join(sib_card(x, base) for x in TUBS if x["line"] == t["line"] and x["k"] != k)
    ask = sms(f"Hi Blaine, I'm interested in the {n} hot tub. What's your best price?")
    fit = sms(f"Hi Blaine, I'm trying to decide if the {n} is right for me.")
    seat_kind = ("Your lounger", "Lie back and the jets run from your shoulders down to your feet. Most people try it first.") if lounge else \
                ("Upright seats", "Everyone sits up at the same height, face to face, with room to move around. It's the layout people pick when the tub is for talking, family nights and having people over.")
    heading = layout[0].upper() + layout[1:]
    return f"""<section class="lhero thero">
  <div class="wrap">
    <a class="back" href="{base}{t['line']}/">&larr; The {ln} line</a>
    <div class="lgrid">
      <div>
        <p class="eyebrow">The {ln} line &middot; Platinum Spas</p>
        <h1>The {esc(n)}</h1>
        <p class="tlead">{esc(cp['head'])}</p>
        <ul class="tchips">{chip_html}</ul>
        <div class="ctas">
          <a class="btn btn-gold" href="{ask}">{CHAT}Text Blaine for price</a>
          <a class="btn btn-ghost" href="{TEL}">{PHONE}Call Blaine</a>
        </div>
      </div>
      <img class="lphoto" src="{base}assets/img/{k}.webp" alt="The {esc(n)} hot tub seen from above" width="560" height="560">
    </div>
  </div>
</section>
<section class="twhy">
  <div class="wrap narrowish">
    <p class="eyebrow teal">Why people choose the {esc(n)}</p>
    <blockquote class="belief light"><p>{esc(cp['why'])}</p><footer><img src="{base}assets/img/logo.webp" alt="" width="40" height="40"><span><b>{SITE['owner']}</b><br>Owner, North Grenville Hot Tubs</span></footer></blockquote>
  </div>
</section>
<section class="tfit">
  <div class="wrap tfitgrid">
    <div>
      <p class="eyebrow teal">Is it the one?</p>
      <h2>The {esc(n)} may be perfect for you if&hellip;</h2>
      <ul class="checks">{perfect}</ul>
    </div>
    <aside class="honest">
      <p class="eyebrow">Blaine's honest take</p>
      <p>{esc(cp['honest'])}</p>
      <a class="btn btn-line btn-sm" href="{fit}">{CHAT}Ask Blaine which fits</a>
    </aside>
  </div>
</section>
<section class="tseats">
  <div class="wrap narrowish">
    <p class="eyebrow teal">How the seats work</p>
    <h2>{esc(heading)}.</h2>
    <p class="seatline">{esc(cp['seating'])}</p>
    <div class="jetkinds">
      <div><b>Rotating jets</b><p>They spin as they push, for a firmer, deeper massage. These are the ones people want on sore backs and shoulders.</p></div>
      <div><b>Directional jets</b><p>A steady, gentler stream. Good for tired legs, arms and feet, or when you just want to unwind.</p></div>
      <div><b>{seat_kind[0]}</b><p>{seat_kind[1]}</p></div>
    </div>
    <p class="muted small">The best way to know is to sit in it. Come to the warehouse by appointment and try the seats before you decide.</p>
  </div>
</section>
<section class="tspecs">
  <div class="wrap tspecgrid">
    <div>
      <p class="eyebrow teal">The details</p>
      <h2>{esc(n)} specifications</h2>
      <dl class="spectable">{spec_html}</dl>
      <p class="muted small">Specs as published by Platinum Spas. Blaine will confirm the details for your tub and help you check your space, base and power before you order.</p>
    </div>
    <div>
      <p class="eyebrow teal">What comes with it</p>
      <h2>Built in.</h2>
      <ul class="feats">{feats}</ul>
    </div>
  </div>
</section>
<section class="next">
  <div class="wrap">
    <p class="eyebrow">Next step</p>
    <h2>Text Blaine for your price on the {esc(n)}.</h2>
    <ol>
      <li><b>He answers you himself</b><p>Your price, your questions, and an honest read on whether the {esc(n)} is the right tub for you.</p></li>
      <li><b>You sit in it</b><p>Come to the warehouse at {SITE['street']} by appointment and try the seats.</p></li>
      <li><b>Your tub is ordered</b><p>Built to your colour and spec through Platinum Spas, then delivered to your yard.</p></li>
      <li><b>First soak, clean water</b><p>We set you up with O-Care and a weekly routine that takes minutes. {OCARE_A}Register your O-Care with Blaine</a> and it comes to your door, so you never run out.</p></li>
    </ol>
    <div class="ctas">
      <a class="btn btn-gold" href="{ask}">{CHAT}Text Blaine for price</a>
      <a class="btn btn-ghost" href="{TEL}">{PHONE}Call Blaine</a>
    </div>
    <p class="num">{SITE['phone_display']}</p>
  </div>
</section>
<section class="others">
  <div class="wrap">
    <p class="eyebrow teal">Compare the rest of the {ln} line</p>
    <div class="sibs">{sib_html}</div>
    <p class="allines"><a href="{base}#lines">See all three hot tub lines &rarr;</a></p>
  </div>
</section>"""


def tub_jsonld(t):
    sp, cp = SPECS[t["k"]], COPY[t["k"]]
    url = f"{SITE['url']}/{t['line']}/{t['k']}/"
    data = {"@context": "https://schema.org", "@graph": [
        {"@type": "Product", "name": f"Platinum Spas {t['n']} hot tub", "brand": {"@type": "Brand", "name": "Platinum Spas"},
         "image": f"{SITE['url']}/assets/img/{t['k']}.webp", "description": f"{cp['head']} {cp['why']}",
         "category": "Hot tub", "url": url,
         "additionalProperty": [{"@type": "PropertyValue", "name": "Seats", "value": t["seats"]},
                                {"@type": "PropertyValue", "name": "Jets", "value": t["jets"]},
                                {"@type": "PropertyValue", "name": "Power", "value": sp["power"]}]},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Hot tubs", "item": f"{SITE['url']}/"},
            {"@type": "ListItem", "position": 2, "name": f"{LINES[t['line']]['name']} line", "item": f"{SITE['url']}/{t['line']}/"},
            {"@type": "ListItem", "position": 3, "name": t["n"], "item": url}]}]}
    return f'<script type="application/ld+json">{json.dumps(data)}</script>\n'

# ---------- Swim spas and mini pools ----------
SWIM = json.loads((SRC / "swim.json").read_text())
SWIM_MODELS = SWIM["models"]


def swim_img(m):
    return m.get("img", m["k"])


def swim_card(m, base):
    sysname = SWIM["systems"][m["system"]]["name"]
    w, d, h = m["dims"]
    people = f"<div><b>{m['people']}</b><span>People</span></div>" if m.get("people") else "<div><b>In-ground</b><span>Install</span></div>"
    return f"""<article class="swimcard">
      <a class="ph" href="{base}{m['section']}/{m['k']}/" aria-label="See the {esc(m['n'])} in detail"><img src="{base}assets/img/{swim_img(m)}.webp" alt="The {esc(m['n'])} seen from above" loading="lazy" width="1200" height="560"></a>
      <div class="bd">
        <p class="eyebrow teal">{esc(sysname)}{' &middot; split temperature' if m.get('split') else ''}</p>
        <h3 class="tubname"><a href="{base}{m['section']}/{m['k']}/">The {esc(m['n'])}</a></h3>
        {f'<div class="specs">{people}<div><b>{w // 12}&prime;{w % 12}&Prime;</b><span>Long</span></div><div><b>{m["jets"]}</b><span>Jets</span></div></div>' if m['section'] == 'swim-spas' else f'<div class="specs two"><div><b>{w // 12}&prime;{w % 12}&Prime;</b><span>Long</span></div><div><b>{esc(m.get("entry", ""))}</b><span>Layout</span></div></div>'}
        <p class="note">{esc(m['head'])}</p>
        <a class="tubmore" href="{base}{m['section']}/{m['k']}/">See the details <span aria-hidden="true">&rarr;</span></a>
        <div class="acts">
          <a class="btn btn-ink" href="{sms(f"Hi Blaine, I'm interested in the {m['n']}. What's your best price?")}">Text Blaine for price</a>
          <a class="btn btn-line" href="{TEL}" aria-label="Call Blaine about the {esc(m['n'])}">Call</a>
        </div>
      </div>
    </article>"""


def swim_section_body(sid, base):
    S = SWIM["sections"][sid]
    models = [m for m in SWIM_MODELS if m["section"] == sid]
    cards = "\n    ".join(swim_card(m, base) for m in models)
    hero_img = "swim" if sid == "swim-spas" else "chronos"
    moments = ""
    if S.get("moments"):
        mm = "".join(f"<article><h3>{esc(a)}</h3><p>{ocl(esc(b))}</p></article>" for a, b in S["moments"])
        moments = f"""<section class="moments">
  <div class="wrap">
    <p class="eyebrow teal">Picture it in your backyard</p>
    <h2>What owning {'a swim spa' if sid == 'swim-spas' else 'a mini pool'} feels like.</h2>
    <div class="mgrid">{mm}</div>
  </div>
</section>"""
    systems = ""
    if True:
        sy = "".join(f"<div><b>{esc(v['name'])}</b><p>{esc(v['short'] if sid == 'swim-spas' else v['short_pool'])}</p><small>{', '.join('The ' + esc(m['n']) for m in models if m['system'] == k)}</small></div>" for k, v in SWIM["systems"].items())
        systems = f"""<section class="tseats">
  <div class="wrap narrowish">
    <p class="eyebrow teal">The first choice</p>
    <h2>River jet or turbine?</h2>
    <p class="seatline">Every {'swim spa' if sid == 'swim-spas' else 'mini pool'} gives you a current to swim against. The difference is how it's made, and that decides how it feels.</p>
    <div class="jetkinds two">{sy}</div>
    <p class="muted small">{'The Helios and Helios Pro also split into two separate tubs, so the swim end and the hot tub end can sit at different temperatures.' if sid == 'swim-spas' else 'Every mini pool comes in both. Then pick the layout: a corner step (Atlas), a full-width step (Chronos), a completely open lane (Hades), or two loungers (Artemis Pro).'}</p>
  </div>
</section>"""
    others = [("deluxe/", "Hot tubs", "The Deluxe, Premium and Luxury lines"), ("mini-pools/" if sid == "swim-spas" else "swim-spas/", "Mini pools" if sid == "swim-spas" else "Swim spas", "Seven in-ground models, built into your yard" if sid == "swim-spas" else "Seven models, river jet and turbine")]
    other = "".join(f'<a href="{base}{u}"><span>{esc(a)}</span><b>{esc(b)}</b><em>See them &rarr;</em></a>' for u, a, b in others)
    help_p = f'<p class="help">{esc(S["help"])}</p>' if S.get("help") else ""
    return f"""<section class="lhero">
  <div class="wrap">
    <a class="back" href="{base}#more">&larr; Everything we sell</a>
    <div class="lgrid">
      <div>
        <p class="eyebrow">{esc(S['name'])} &middot; Platinum Spas</p>
        <h1>{esc(S['title'])}</h1>
        <blockquote class="belief"><p>{esc(S['believe'])}</p><footer><img src="{base}assets/img/logo.webp" alt="" width="40" height="40"><span><b>{SITE['owner']}</b><br>Owner, North Grenville Hot Tubs</span></footer></blockquote>
        <div class="ctas">
          <a class="btn btn-gold" href="#pick">See the {'models' if len(models) > 1 else esc(models[0]['n'])}</a>
          <a class="btn btn-ghost" href="{sms(f"Hi Blaine, I'd like to talk about {S['name'].lower()}.")}">{CHAT}Text Blaine</a>
        </div>
      </div>
      <img class="lphoto" src="{base}assets/img/{hero_img}.webp" alt="" width="560" height="560">
    </div>
  </div>
</section>
{moments}
{systems}
<section class="pick" id="pick">
  <div class="wrap">
    <div class="pickhead"><div>
      <p class="eyebrow teal">Choose yours</p>
      <h2>{'Which swim spa is yours?' if sid == 'swim-spas' else 'Which mini pool is yours?'}</h2>
      <p class="intro">{'Start with how you will use it: swimming laps, family play, or both with a hot soak.' if sid == 'swim-spas' else 'All seven are the same 19 ft 8 in footprint. Choose the current, then the layout.'}</p>
    </div></div>
    <div class="grid swimgrid">
    {cards}
    </div>
  </div>
</section>
<section class="next">
  <div class="wrap">
    <p class="eyebrow">Next step</p>
    <h2>What happens after you text Blaine.</h2>
    <ol>
      <li><b>He answers you himself</b><p>Your price, your questions, and an honest read on which model fits how you'll use it.</p></li>
      <li><b>He checks your yard</b><p>{'Space, base, access and power. These are big, heavy tubs, so it&#x27;s worth getting right first.' if sid == 'swim-spas' else 'Space, access, power, and how it will sit in your landscaping.'}</p></li>
      <li><b>Yours is ordered</b><p>Built to spec through Platinum Spas, then delivered and set in place.</p></li>
      <li><b>First swim, clean water</b><p>We set you up with O-Care and a simple weekly routine. {OCARE_A}Register your O-Care with Blaine</a> and it comes to your door, so you never run out.</p></li>
    </ol>
    {help_p}
    <div class="ctas">
      <a class="btn btn-gold" href="{TEL}">{PHONE}Call Blaine</a>
      <a class="btn btn-ghost" href="{sms(f"Hi Blaine, I'm interested in {S['name'].lower()}.")}">{CHAT}Text Blaine for price</a>
    </div>
    <p class="num">{SITE['phone_display']}</p>
  </div>
</section>
<section class="others">
  <div class="wrap">
    <p class="eyebrow teal">Still deciding?</p>
    <div class="ogrid">{other}</div>
  </div>
</section>"""


def swim_body(m, base):
    S = SWIM["sections"][m["section"]]
    sysv = SWIM["systems"][m["system"]]
    n = m["n"]
    w, d, h = m["dims"]
    size = f"{ftin(w)} x {ftin(d)}"
    pool = m["section"] == "mini-pools"
    chips = ([f"For {m['people']} people"] if m.get("people") and not pool else ["Fully in-ground"]) + [size, sysv["name"]] + ([m["entry"]] if pool else [m["power"]])
    chip_html = "".join(f"<li>{esc(c)}</li>" for c in chips)
    perfect = "".join(f"<li>{esc(x)}</li>" for x in m["perfect"])
    seats = ""
    if m.get("seats") is not None:
        lo = m.get("loungers", 0)
        seats = f"{m['seats']} seat{'s' if m['seats'] != 1 else ''}" + (f" and {lo} lounger{'s' if lo > 1 else ''}" if lo else "")
    rows = [("Swim current", sysv["name"])]
    if seats:
        rows.append(("Hot tub seating", f"{seats}, for {m['people']} people"))
    rows += [
        ("Layout", m["entry"]) if m.get("entry") else None,
        ("Jets", f"{m['jets']}" + (f": {m['jetmix']}" if m.get("jetmix") else "")) if m.get("jets") else None,
        ("Size", f"{w} x {d} in, {h} in {'shell depth' if pool else 'tall'} ({size}, about {round(w * 2.54)} x {round(d * 2.54)} cm)"),
    ]
    if m.get("gal"):
        rows.append(("Water", f"{m['gal']} gallons"))
    rows.append(("Weight", f"{m['dry']:,} lb empty" + (f", {m['wet']:,} lb filled" if m.get("wet") else "")))
    rows += [("Pumps", m["pumps"]), ("Heater", m["heater"]), ("Power", m["power"]), ("Controls", m["controls"])]
    if m.get("split"):
        rows.insert(1, ("Zones", "Fully split swim and hot tub ends, each with its own temperature"))
    rows = [r for r in rows if r]
    spec_html = "".join(f"<div><dt>{esc(a)}</dt><dd>{esc(b)}</dd></div>" for a, b in rows)
    feats = "".join(f"<li>{esc(f)}</li>" for f in m["extra"])
    sibs = "".join(f"""<a class="sib" href="{base}{x['section']}/{x['k']}/"><img src="{base}assets/img/{swim_img(x)}.webp" alt="" loading="lazy" width="160" height="80"><span><b>The {esc(x['n'])}</b><small>{esc(SWIM['systems'][x['system']]['name'])} &middot; {ftin(x['dims'][0])}</small><em>{esc(x['head'])}</em></span></a>"""
                   for x in SWIM_MODELS if x["k"] != m["k"] and x["section"] == m["section"])
    ask = sms(f"Hi Blaine, I'm interested in the {n}. What's your best price?")
    fit = sms(f"Hi Blaine, I'm trying to decide if the {n} is right for me.")
    return f"""<section class="lhero thero">
  <div class="wrap">
    <a class="back" href="{base}{m['section']}/">&larr; {esc(S['name'])}</a>
    <div class="lgrid swimhero">
      <div>
        <p class="eyebrow">{esc(S['name'][:-1] if not pool else 'Mini pool')} &middot; Platinum Spas</p>
        <h1>The {esc(n)}</h1>
        <p class="tlead">{esc(m['head'])}</p>
        <ul class="tchips">{chip_html}</ul>
        <div class="ctas">
          <a class="btn btn-gold" href="{ask}">{CHAT}Text Blaine for price</a>
          <a class="btn btn-ghost" href="{TEL}">{PHONE}Call Blaine</a>
        </div>
      </div>
      <img class="lphoto wide" src="{base}assets/img/{swim_img(m)}.webp" alt="The {esc(n)} seen from above" width="1200" height="560">
    </div>
  </div>
</section>
<section class="twhy">
  <div class="wrap narrowish">
    <p class="eyebrow teal">Why people choose the {esc(n)}</p>
    <blockquote class="belief light"><p>{esc(m['why'])}</p><footer><img src="{base}assets/img/logo.webp" alt="" width="40" height="40"><span><b>{SITE['owner']}</b><br>Owner, North Grenville Hot Tubs</span></footer></blockquote>
  </div>
</section>
<section class="tfit">
  <div class="wrap tfitgrid">
    <div>
      <p class="eyebrow teal">Is it the one?</p>
      <h2>The {esc(n)} may be perfect for you if&hellip;</h2>
      <ul class="checks">{perfect}</ul>
    </div>
    <aside class="honest">
      <p class="eyebrow">Blaine's honest take</p>
      <p>{esc(m['honest'])}</p>
      <a class="btn btn-line btn-sm" href="{fit}">{CHAT}Ask Blaine which fits</a>
    </aside>
  </div>
</section>
<section class="tseats">
  <div class="wrap narrowish">
    <p class="eyebrow teal">How it works</p>
    <h2>{esc(sysv['name'])} current.</h2>
    <p class="seatline">{esc(sysv['short_pool'] if pool else sysv['short'])}</p>
    <p class="seatline">{esc(m['seating'])}</p>
    <p class="muted small">The best way to know is to see it in person. Text Blaine and he'll talk you through what fits your yard and how you'll use it.</p>
  </div>
</section>
<section class="tspecs">
  <div class="wrap tspecgrid">
    <div>
      <p class="eyebrow teal">The details</p>
      <h2>{esc(n)} specifications</h2>
      <dl class="spectable">{spec_html}</dl>
      <p class="muted small">Specs as published by Platinum Spas. Blaine will confirm the details for yours and help you check your space, base, access and power before you order.</p>
    </div>
    <div>
      <p class="eyebrow teal">What comes with it</p>
      <h2>Built in.</h2>
      <ul class="feats">{feats}</ul>
    </div>
  </div>
</section>
<section class="next">
  <div class="wrap">
    <p class="eyebrow">Next step</p>
    <h2>Text Blaine for your price on the {esc(n)}.</h2>
    <ol>
      <li><b>He answers you himself</b><p>Your price, your questions, and an honest read on whether the {esc(n)} is right for you.</p></li>
      <li><b>He checks your yard</b><p>Space, base, access and power, before anything is ordered.</p></li>
      <li><b>Yours is ordered</b><p>Built to spec through Platinum Spas, then delivered and set in place.</p></li>
      <li><b>First swim, clean water</b><p>We set you up with O-Care and a simple weekly routine. {OCARE_A}Register your O-Care with Blaine</a> and it comes to your door, so you never run out.</p></li>
    </ol>
    <div class="ctas">
      <a class="btn btn-gold" href="{ask}">{CHAT}Text Blaine for price</a>
      <a class="btn btn-ghost" href="{TEL}">{PHONE}Call Blaine</a>
    </div>
    <p class="num">{SITE['phone_display']}</p>
  </div>
</section>
<section class="others">
  <div class="wrap">
    <p class="eyebrow teal">{'Compare the swim spas' if not pool else 'Compare the mini pools'}</p>
    <div class="sibs swimsibs">{sibs}</div>
    <p class="allines"><a href="{base}{'mini-pools' if not pool else 'swim-spas'}/">{'Or see the mini pools' if not pool else 'Rather have it above ground? See the swim spas'} &rarr;</a></p>
  </div>
</section>"""


def swim_jsonld(m):
    S = SWIM["sections"][m["section"]]
    url = f"{SITE['url']}/{m['section']}/{m['k']}/"
    data = {"@context": "https://schema.org", "@graph": [
        {"@type": "Product", "name": f"Platinum Spas {m['n']} {'mini pool' if m['section'] == 'mini-pools' else 'swim spa'}",
         "brand": {"@type": "Brand", "name": "Platinum Spas"}, "image": f"{SITE['url']}/assets/img/{swim_img(m)}.webp",
         "description": f"{m['head']} {m['why']}", "category": "Mini pool" if m["section"] == "mini-pools" else "Swim spa", "url": url},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE['url']}/"},
            {"@type": "ListItem", "position": 2, "name": S["name"], "item": f"{SITE['url']}/{m['section']}/"},
            {"@type": "ListItem", "position": 3, "name": m["n"], "item": url}]}]}
    return f'<script type="application/ld+json">{json.dumps(data)}</script>\n'

# ---------- Saunas (Hekla) ----------
SAUNA = json.loads((SRC / "saunas.json").read_text())
SAUNA_MODELS = SAUNA["models"]
RANGES = {r["id"]: r for r in SAUNA["ranges"]}


def sauna_size(m):
    """Readable size line, and a short version for cards."""
    if m.get("dims_in"):
        w, d, h = m["dims_in"]
        where = " inside" if m.get("dims_note") == "inside" else ""
        return f"{w:g} x {d:g} x {h:g} in{where} (about {ftin(round(w))} x {ftin(round(d))})", f"{ftin(round(w))} x {ftin(round(d))}"
    if m.get("dims_cm"):
        w, d, h = m["dims_cm"]
        wi, di, hi = (round(x / 2.54) for x in (w, d, h))
        return f"{w} x {d} x {h} cm (about {ftin(wi)} x {ftin(di)}, {ftin(hi)} tall)", f"{ftin(wi)} x {ftin(di)}"
    if m.get("size"):
        return m["size"], m["size"]
    return "", ""


def sauna_card(m, base):
    R = RANGES[m["range"]]
    kind = {"traditional": "Classic"}.get(m["kind"], SAUNA["kinds"][m["kind"]]["name"])
    return f"""<article class="tub sauna">
      <a class="ph" href="{base}saunas/{m['k']}/" aria-label="See the {esc(m['n'])} in detail"><img src="{base}assets/img/{m['img']}.webp" alt="The Hekla {esc(m['n'])} sauna" loading="lazy" width="800" height="800"></a>
      <div class="bd">
        <h3 class="tubname"><a href="{base}saunas/{m['k']}/">The {esc(m['n'])}</a></h3>
        <div class="specs"><div><b>{esc(m['people'])}</b><span>People</span></div><div><b>{R['where']}</b><span>Where</span></div><div><b>{kind}</b><span>Heat</span></div></div>
        <p class="note">{esc(m['head'])}</p>
        <a class="tubmore" href="{base}saunas/{m['k']}/">See the details <span aria-hidden="true">&rarr;</span></a>
        <div class="acts">
          <a class="btn btn-ink" href="{sms(f"Hi Blaine, I'm interested in the Hekla {m['n']} sauna. What's your best price?")}">Text Blaine for price</a>
          <a class="btn btn-line" href="{TEL}" aria-label="Call Blaine about the {esc(m['n'])}">Call</a>
        </div>
      </div>
    </article>"""


def saunas_body(base):
    mm = "".join(f"<article><h3>{esc(a)}</h3><p>{esc(b)}</p></article>" for a, b in SAUNA["moments"])
    kinds = "".join(f"<div><b>{esc(v['name'])}</b><p>{esc(v['short'])}</p></div>" for v in SAUNA["kinds"].values())
    groups = ""
    RANGE_KIND = {r["id"]: next(m["kind"] for m in SAUNA_MODELS if m["range"] == r["id"]) for r in SAUNA["ranges"]}
    for r in SAUNA["ranges"]:
        cards = "\n      ".join(sauna_card(m, base) for m in SAUNA_MODELS if m["range"] == r["id"])
        groups += f"""
    <div class="rangegroup" id="{r['id']}" data-where="{r['where'].lower()}" data-heat="{RANGE_KIND[r['id']]}">
      <div class="rangehead"><h3>{esc(r['name'])} <span>{r['where']}</span></h3><p>{esc(r['line'])}</p></div>
      <div class="grid">
      {cards}
      </div>
    </div>"""
    return f"""<section class="lhero">
  <div class="wrap">
    <a class="back" href="{base}#more">&larr; Everything we sell</a>
    <div class="lgrid">
      <div>
        <p class="eyebrow">Saunas &middot; {SAUNA['brand']}</p>
        <h1>{esc(SAUNA['title'])}</h1>
        <blockquote class="belief"><p>{esc(SAUNA['believe'])}</p><footer><img src="{base}assets/img/logo.webp" alt="" width="40" height="40"><span><b>{SITE['owner']}</b><br>Owner, North Grenville Hot Tubs</span></footer></blockquote>
        <div class="ctas">
          <a class="btn btn-gold" href="#pick">See the saunas</a>
          <a class="btn btn-ghost" href="{sms("Hi Blaine, I'd like to talk about a sauna.")}">{CHAT}Text Blaine</a>
        </div>
      </div>
      <img class="lphoto light" src="{base}assets/img/sauna-cube.webp" alt="The Hekla Cube outdoor sauna" width="560" height="560">
    </div>
  </div>
</section>
<section class="moments">
  <div class="wrap">
    <p class="eyebrow teal">Picture it at home</p>
    <h2>What owning a sauna feels like.</h2>
    <div class="mgrid">{mm}</div>
  </div>
</section>
<section class="tseats">
  <div class="wrap narrowish">
    <p class="eyebrow teal">The first choice</p>
    <h2>Traditional or infrared?</h2>
    <p class="seatline">Both give you twenty quiet minutes of warmth. The difference is how they heat, and that decides how it feels.</p>
    <div class="jetkinds two">{kinds}</div>
    <p class="muted small">Our outdoor saunas are the Cube, Barrel and Cabin ranges, and they are all traditional. The Cube and Barrel can also take a wood-burning stove.</p>
  </div>
</section>
<section class="pick" id="pick">
  <div class="wrap">
    <div class="pickhead">
      <div>
        <p class="eyebrow teal">Choose yours</p>
        <h2>Which sauna is yours?</h2>
        <p class="intro">Choose where it goes and how you like your heat.</p>
      </div>
      <div class="filtersets">
        <div class="filterset"><span class="flabel" id="fWhere">Where it goes</span>
          <div class="filters" role="group" aria-labelledby="fWhere">
            <button class="chip" type="button" data-f="where" data-v="all" aria-pressed="true">All</button>
            <button class="chip" type="button" data-f="where" data-v="indoor" aria-pressed="false">Indoor</button>
            <button class="chip" type="button" data-f="where" data-v="outdoor" aria-pressed="false">Outdoor</button>
          </div>
        </div>
        <div class="filterset"><span class="flabel" id="fHeat">How it heats</span>
          <div class="filters" role="group" aria-labelledby="fHeat">
            <button class="chip" type="button" data-f="heat" data-v="all" aria-pressed="true">All</button>
            <button class="chip" type="button" data-f="heat" data-v="traditional" aria-pressed="false">Traditional</button>
            <button class="chip" type="button" data-f="heat" data-v="infrared" aria-pressed="false">Infrared</button>
          </div>
        </div>
      </div>
    </div>
    <p class="pickcount" id="pickCount" aria-live="polite"></p>{groups}
    <div class="pickempty" id="pickEmpty" hidden>
      <h3>All of our outdoor saunas are traditional.</h3>
      <p>Our infrared cabins are made for indoors, so outside you get real heat and steam from a heater and rocks. If you like the gentler warmth of infrared, an indoor infrared cabin fits in a basement or spare room.</p>
      <div class="ctas"><button class="btn btn-ink" type="button" data-pick="indoor,infrared">See indoor infrared</button><button class="btn btn-line" type="button" data-pick="outdoor,traditional">See outdoor saunas</button></div>
    </div>
  </div>
</section>
<section class="next">
  <div class="wrap">
    <p class="eyebrow">Next step</p>
    <h2>What happens after you text Blaine.</h2>
    <ol>
      <li><b>He answers you himself</b><p>Your price, your questions, and an honest read on which sauna fits your space and how you'll use it.</p></li>
      <li><b>He checks your space</b><p>Room, base, and power. Most saunas need a 240V circuit for the heater, so it's worth sorting out first.</p></li>
      <li><b>Yours is ordered</b><p>In the finish you choose, with the heater that suits you.</p></li>
      <li><b>Your first session</b><p>Then pair it with your hot tub for a full hot and cold routine at home.</p></li>
    </ol>
    <div class="ctas">
      <a class="btn btn-gold" href="{TEL}">{PHONE}Call Blaine</a>
      <a class="btn btn-ghost" href="{sms("Hi Blaine, I'm interested in a sauna.")}">{CHAT}Text Blaine for price</a>
    </div>
    <p class="num">{SITE['phone_display']}</p>
  </div>
</section>
<section class="others">
  <div class="wrap">
    <p class="eyebrow teal">Pair it with</p>
    <div class="ogrid"><a href="{base}#lines"><span>Hot tubs</span><b>The Deluxe, Premium and Luxury lines</b><em>See them &rarr;</em></a><a href="{base}swim-spas/"><span>Swim spas</span><b>Swim, move and soak all year</b><em>See them &rarr;</em></a></div>
  </div>
</section>
<script>
(function () {{
  var f = {{ where: 'all', heat: 'all' }};
  function apply() {{
    var shown = 0;
    document.querySelectorAll('[data-f]').forEach(function (x) {{ x.setAttribute('aria-pressed', f[x.dataset.f] === x.dataset.v ? 'true' : 'false'); }});
    document.querySelectorAll('.rangegroup').forEach(function (g) {{
      var on = (f.where === 'all' || g.dataset.where === f.where) && (f.heat === 'all' || g.dataset.heat === f.heat);
      g.hidden = !on; if (on) shown += g.querySelectorAll('article.tub').length;
    }});
    document.getElementById('pickEmpty').hidden = shown > 0;
    document.getElementById('pickCount').textContent = (f.where === 'all' && f.heat === 'all') ? '' : shown ? 'Showing ' + shown + (shown === 1 ? ' sauna' : ' saunas') : '';
  }}
  document.querySelectorAll('[data-f]').forEach(function (b) {{ b.addEventListener('click', function () {{ f[b.dataset.f] = b.dataset.v; apply(); }}); }});
  document.querySelectorAll('[data-pick]').forEach(function (b) {{ b.addEventListener('click', function () {{ var p = b.dataset.pick.split(','); f.where = p[0]; f.heat = p[1]; apply(); }}); }});
}})();
</script>"""


def sauna_body(m, base):
    R, K = RANGES[m["range"]], SAUNA["kinds"][m["kind"]]
    n = m["n"]
    size_long, size_short = sauna_size(m)
    chips = [f"Seats {m['people']}", R["where"], K["name"]] + ([size_short] if size_short and not m.get("size") else [])
    chip_html = "".join(f"<li>{esc(c)}</li>" for c in chips)
    perfect = "".join(f"<li>{esc(x)}</li>" for x in m["perfect"])
    rows = [("Type", f"{R['where']} {K['name'].lower()} sauna, {R['name']} range"), ("Seats", f"{m['people']} people")]
    if size_long:
        rows.append(("Size", size_long))
    rows += [("Heat", m["heater"])]
    if m.get("warm"):
        rows.append(("Warm-up", m["warm"]))
    rows.append(("Finish", m["finish"]))
    spec_html = "".join(f"<div><dt>{esc(a)}</dt><dd>{esc(b)}</dd></div>" for a, b in rows)
    feats = "".join(f"<li>{esc(f)}</li>" for f in SAUNA["common"][m["range"]])
    sibs = [x for x in SAUNA_MODELS if x["k"] != m["k"] and x["range"] == m["range"]]
    if len(sibs) < 2:
        sibs += [x for x in SAUNA_MODELS if x["k"] != m["k"] and x not in sibs and RANGES[x["range"]]["where"] == R["where"]][:3]
    sib_html = "".join(f"""<a class="sib" href="{base}saunas/{x['k']}/"><img src="{base}assets/img/{x['img']}.webp" alt="" loading="lazy" width="160" height="160"><span><b>The {esc(x['n'])}</b><small>Seats {esc(x['people'])} &middot; {RANGES[x['range']]['where']}</small><em>{esc(x['head'])}</em></span></a>""" for x in sibs)
    ask = sms(f"Hi Blaine, I'm interested in the Hekla {n} sauna. What's your best price?")
    fit = sms(f"Hi Blaine, I'm trying to decide if the Hekla {n} sauna is right for me.")
    return f"""<section class="lhero thero">
  <div class="wrap">
    <a class="back" href="{base}saunas/#{m['range']}">&larr; All saunas</a>
    <div class="lgrid">
      <div>
        <p class="eyebrow">{esc(R['name'])} range &middot; {SAUNA['brand']} saunas</p>
        <h1>The {esc(n)}</h1>
        <p class="tlead">{esc(m['head'])}</p>
        <ul class="tchips">{chip_html}</ul>
        <div class="ctas">
          <a class="btn btn-gold" href="{ask}">{CHAT}Text Blaine for price</a>
          <a class="btn btn-ghost" href="{TEL}">{PHONE}Call Blaine</a>
        </div>
      </div>
      <img class="lphoto light" src="{base}assets/img/{m['img']}.webp" alt="The Hekla {esc(n)} sauna" width="560" height="560">
    </div>
  </div>
</section>
<section class="twhy">
  <div class="wrap narrowish">
    <p class="eyebrow teal">Why people choose the {esc(n)}</p>
    <blockquote class="belief light"><p>{esc(m['why'])}</p><footer><img src="{base}assets/img/logo.webp" alt="" width="40" height="40"><span><b>{SITE['owner']}</b><br>Owner, North Grenville Hot Tubs</span></footer></blockquote>
  </div>
</section>
<section class="tfit">
  <div class="wrap tfitgrid">
    <div>
      <p class="eyebrow teal">Is it the one?</p>
      <h2>The {esc(n)} may be perfect for you if&hellip;</h2>
      <ul class="checks">{perfect}</ul>
    </div>
    <aside class="honest">
      <p class="eyebrow">Blaine's honest take</p>
      <p>{esc(m['honest'])}</p>
      <a class="btn btn-line btn-sm" href="{fit}">{CHAT}Ask Blaine which fits</a>
    </aside>
  </div>
</section>
<section class="tseats">
  <div class="wrap narrowish">
    <p class="eyebrow teal">How it heats</p>
    <h2>{esc(K['name'])} heat.</h2>
    <p class="seatline">{esc(K['short'])}</p>
    <p class="seatline">{esc(R['line'])}</p>
    <p class="muted small">Pair it with your hot tub for a hot and cold routine at home. If you have a health condition, check with your doctor before using a sauna.</p>
  </div>
</section>
<section class="tspecs">
  <div class="wrap tspecgrid">
    <div>
      <p class="eyebrow teal">The details</p>
      <h2>{esc(n)} specifications</h2>
      <dl class="spectable">{spec_html}</dl>
      <p class="muted small">Specs as published by {SAUNA['brand']}. Blaine will confirm the details for yours, including the heater and the power it needs, before you order.</p>
    </div>
    <div>
      <p class="eyebrow teal">What comes with it</p>
      <h2>Built in.</h2>
      <ul class="feats">{feats}</ul>
    </div>
  </div>
</section>
<section class="next">
  <div class="wrap">
    <p class="eyebrow">Next step</p>
    <h2>Text Blaine for your price on the {esc(n)}.</h2>
    <ol>
      <li><b>He answers you himself</b><p>Your price, your questions, and an honest read on whether the {esc(n)} is right for you.</p></li>
      <li><b>He checks your space</b><p>Room, base and power, before anything is ordered.</p></li>
      <li><b>Yours is ordered</b><p>In the finish you choose, with the heater that suits you.</p></li>
      <li><b>Your first session</b><p>Twenty quiet minutes, then a cool-down or a soak in the tub.</p></li>
    </ol>
    <div class="ctas">
      <a class="btn btn-gold" href="{ask}">{CHAT}Text Blaine for price</a>
      <a class="btn btn-ghost" href="{TEL}">{PHONE}Call Blaine</a>
    </div>
    <p class="num">{SITE['phone_display']}</p>
  </div>
</section>
<section class="others">
  <div class="wrap">
    <p class="eyebrow teal">Compare</p>
    <div class="sibs">{sib_html}</div>
    <p class="allines"><a href="{base}saunas/">See all {len(SAUNA_MODELS)} saunas &rarr;</a></p>
  </div>
</section>"""


def sauna_jsonld(m):
    url = f"{SITE['url']}/saunas/{m['k']}/"
    data = {"@context": "https://schema.org", "@graph": [
        {"@type": "Product", "name": f"Hekla {m['n']} sauna", "brand": {"@type": "Brand", "name": SAUNA["brand"]},
         "image": f"{SITE['url']}/assets/img/{m['img']}.webp", "description": f"{m['head']} {m['why']}", "category": "Sauna", "url": url},
        {"@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{SITE['url']}/"},
            {"@type": "ListItem", "position": 2, "name": "Saunas", "item": f"{SITE['url']}/saunas/"},
            {"@type": "ListItem", "position": 3, "name": m["n"], "item": url}]}]}
    return f'<script type="application/ld+json">{json.dumps(data)}</script>\n'


def business_jsonld():
    data = {
        "@context": "https://schema.org",
        "@type": "HomeAndConstructionBusiness",
        "name": SITE["name"],
        "url": SITE["url"] + "/",
        "telephone": SITE["phone_tel"],
        "email": SITE["email"],
        "image": SITE["url"] + "/assets/img/logo.png",
        "address": {"@type": "PostalAddress", "streetAddress": SITE["street"], "addressLocality": SITE["city"],
                    "addressRegion": SITE["province"], "postalCode": SITE["postal"], "addressCountry": "CA"},
        "areaServed": ["Kemptville", "North Grenville", "Burritts Rapids", "Oxford Mills", "Oxford Station",
                       "Bishops Mills", "Heckston", "Peltons Corners"],
        "founder": SITE["owner"],
        "sameAs": [SITE["facebook"]],
    }
    return f'<script type="application/ld+json">{json.dumps(data)}</script>\n'


# ---------- Blog ----------
POSTS_DIR = SRC / "posts"
MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"]


def nice_date(d):
    y, m, dd = (int(x) for x in d.split("-"))
    return f"{MONTHS[m - 1]} {dd}, {y}"


def inline_md(s):
    s = esc(s, quote=False)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)", r"<em>\1</em>", s)
    return re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)", lambda m: f'<a href="{m.group(2)}">{m.group(1)}</a>', s)


def md_to_html(text):
    """Small Markdown subset: ## / ### headings, paragraphs, - and 1. lists, > quotes, **bold**, *italic*, [links](url)."""
    out, para, lst, kind = [], [], [], None

    def flush():
        nonlocal para, lst, kind
        if para:
            out.append(f"<p>{inline_md(' '.join(para))}</p>")
            para = []
        if lst:
            out.append(f"<{kind}>" + "".join(f"<li>{inline_md(i)}</li>" for i in lst) + f"</{kind}>")
            lst, kind = [], None

    for raw in text.splitlines():
        line = raw.strip()
        if not line:
            flush(); continue
        m = re.match(r"^(#{2,3})\s+(.*)", line)
        if m:
            flush(); n = len(m.group(1)); out.append(f"<h{n}>{inline_md(m.group(2))}</h{n}>"); continue
        if line.startswith("> "):
            flush(); out.append(f"<blockquote><p>{inline_md(line[2:])}</p></blockquote>"); continue
        m = re.match(r"^(-|\d+\.)\s+(.*)", line)
        if m:
            k = "ul" if m.group(1) == "-" else "ol"
            if para: flush()
            if kind and kind != k: flush()
            kind = k; lst.append(m.group(2)); continue
        if lst: flush()
        para.append(line)
    flush()
    return "\n".join(out)


def load_posts():
    posts = []
    for f in sorted(POSTS_DIR.glob("*.md")):
        raw = f.read_text()
        m = re.match(r"^---\n(.*?)\n---\n(.*)$", raw, re.S)
        if not m:
            raise SystemExit(f"{f.name}: missing front matter")
        meta = {}
        for line in m.group(1).splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                meta[k.strip()] = v.strip().strip('"')
        for k in ("title", "description", "date", "image"):
            if not meta.get(k):
                raise SystemExit(f"{f.name}: front matter needs '{k}'")
        if not (ROOT / "assets/img" / f"{meta['image']}.webp").exists():
            raise SystemExit(f"{f.name}: image '{meta['image']}' not found in assets/img")
        meta["slug"] = meta.get("slug") or re.sub(r"^\d{4}-\d{2}-\d{2}-", "", f.stem)
        meta["body"] = m.group(2)
        posts.append(meta)
    return sorted(posts, key=lambda p: p["date"], reverse=True)


def post_body(p, base):
    body = md_to_html(p["body"]).replace('href="/', f'href="{base}')
    return f"""<article class="post">
<section class="phero">
  <div class="wrap">
    <a class="back" href="{base}blog/">&larr; All posts</a>
    <p class="eyebrow">From Blaine &middot; {nice_date(p['date'])}</p>
    <h1>{esc(p['title'])}</h1>
    <div class="byline"><img src="{base}assets/img/logo.webp" alt="" width="44" height="44"><span><b>{SITE['owner']}</b><br>Owner, North Grenville Hot Tubs</span></div>
  </div>
</section>
<div class="wrap">
  <div class="prose">
{body}
    <aside class="postcta">
      <p class="eyebrow">Questions? Ask me directly.</p>
      <h2>Call or text Blaine.</h2>
      <p>I answer my own phone. Tell me how you'd use a hot tub and I'll give you an honest recommendation and a real price.</p>
      <div class="ctas">
        <a class="btn btn-gold" href="{TEL}">{PHONE}Call Blaine</a>
        <a class="btn btn-line" href="{sms("Hi Blaine, I just read your post: " + p['title'])}">{CHAT}Text Blaine</a>
      </div>
      <p class="num">{SITE['phone_display']}</p>
    </aside>
    {subscribe_box("post")}
  </div>
</div>
</article>"""


FUNCTIONS_URL = "https://vpqbgsgrvapxwvstrpfs.supabase.co/functions/v1"


def subscribe_box(source="blog"):
    return f"""<aside class="subbox" id="subscribe">
  <div class="subtext">
    <p class="eyebrow teal">Blaine's posts by email</p>
    <h2>Get the next post in your inbox.</h2>
    <p>After 15 years selling hot tubs, I've seen too many owners fight their water or let a good tub sit unused because nobody gave them straight answers. These posts are those answers: simpler water care, a tub that lasts, and more relaxing nights with your family.</p>
    <p>One short email when a new post goes up, usually Mondays. No pushy sales emails, and you can unsubscribe any time.</p>
  </div>
  <form class="subform" data-endpoint="{FUNCTIONS_URL}/subscribe" data-source="{source}" novalidate>
    <label for="sub-name">First name <span>(optional)</span></label>
    <input id="sub-name" name="first_name" type="text" autocomplete="given-name" maxlength="60">
    <label for="sub-email">Email</label>
    <input id="sub-email" name="email" type="email" autocomplete="email" required>
    <div class="hp" aria-hidden="true"><label for="sub-website">Website</label><input id="sub-website" name="website" type="text" tabindex="-1" autocomplete="off"></div>
    <label class="consent" for="sub-consent"><input id="sub-consent" name="consent" type="checkbox" required> Yes, email me Blaine's new blog posts and occasional news from North Grenville Hot Tubs. I can unsubscribe any time.</label>
    <button class="btn btn-gold" type="submit">Sign me up</button>
    <p class="submsg" role="status" aria-live="polite"></p>
  </form>
</aside>"""


def post_jsonld(p):
    data = {"@context": "https://schema.org", "@type": "BlogPosting", "headline": p["title"], "description": p["description"],
            "datePublished": p["date"], "dateModified": p["date"], "image": f"{SITE['url']}/assets/img/{p['image']}.webp",
            "author": {"@type": "Person", "name": SITE["owner"], "jobTitle": "Owner"},
            "publisher": {"@type": "Organization", "name": SITE["name"], "logo": {"@type": "ImageObject", "url": SITE["url"] + "/assets/img/logo.png"}},
            "mainEntityOfPage": f"{SITE['url']}/blog/{p['slug']}/"}
    return f'<script type="application/ld+json">{json.dumps(data)}</script>\n'


def blog_index(posts, base):
    cards = "".join(f"""<a class="postcard" href="{base}blog/{p['slug']}/">
      <div class="ph"><img src="{base}assets/img/{p['image']}.webp" alt="" loading="lazy" width="560" height="560"></div>
      <div class="bd"><p class="date">{nice_date(p['date'])}</p><h2>{esc(p['title'])}</h2><p>{esc(p['description'])}</p><span class="go">Read it <span aria-hidden="true">&rarr;</span></span></div>
    </a>""" for p in posts) or '<p class="intro">The first post is on its way.</p>'
    return f"""<section class="lhero">
  <div class="wrap" style="padding-block:56px 64px">
    <p class="eyebrow">From the owner</p>
    <h1>Straight talk about hot tubs.</h1>
    <p style="color:var(--sand);margin-top:16px;max-width:56ch">Honest answers to the questions people ask me every week: water care in our hard water, what to look for in a tub, and how to get the most out of yours. New posts every Monday. <b style="color:var(--cream)">Blaine</b></p>
  </div>
</section>
<section class="pick"><div class="wrap"><p class="subnote" hidden></p><div class="postgrid">{cards}</div>{subscribe_box("blog")}</div></section>"""


def build():
    home = fill((SRC / "home.html").read_text(), "")
    page("", "North Grenville Hot Tubs & Saunas | Kemptville, Ontario",
         "Family-owned hot tub store in Kemptville. Platinum Spas hot tubs, swim spas and saunas at wholesale prices. Call or text owner Blaine McAvoy at (613) 292-1786.",
         home, "", business_jsonld())
    for lid, L in LINES.items():
        page(f"{lid}/", f"{L['name']} Hot Tubs: {L['title'][:-1]} | North Grenville Hot Tubs", L["meta"], line_body(lid, "../"), "../")
    for t in TUBS:
        L, cp = LINES[t["line"]], COPY[t["k"]]
        page(f"{t['line']}/{t['k']}/", f"Platinum Spas {t['n']} Hot Tub, Seats {t['seats']} | North Grenville Hot Tubs",
             f"The {t['n']}: {cp['head']} Seats {t['seats']}, {t['jets']} jets. See if it's right for you, then text Blaine in Kemptville for your price.",
             tub_body(t, "../../"), "../../", tub_jsonld(t))
    for sid, S in SWIM["sections"].items():
        page(f"{sid}/", f"{S['name']}: {S['title'][:-1]} | North Grenville Hot Tubs", S["meta"], swim_section_body(sid, "../"), "../")
    for m in SWIM_MODELS:
        kind = "Mini Pool" if m["section"] == "mini-pools" else "Swim Spa"
        page(f"{m['section']}/{m['k']}/", f"Platinum Spas {m['n']} {kind} | North Grenville Hot Tubs",
             f"The {m['n']}: {m['head']} See if it's right for you, then text Blaine in Kemptville for your price.",
             swim_body(m, "../../"), "../../", swim_jsonld(m))
    page("saunas/", f"Saunas: {SAUNA['title'][:-1]} | North Grenville Hot Tubs", SAUNA["meta"], saunas_body("../"), "../")
    for m in SAUNA_MODELS:
        page(f"saunas/{m['k']}/", f"Hekla {m['n']} Sauna, Seats {m['people']} | North Grenville Hot Tubs",
             f"The Hekla {m['n']}: {m['head']} See if it's right for you, then text Blaine in Kemptville for your price.",
             sauna_body(m, "../../"), "../../", sauna_jsonld(m))
    page("404.html", "Page not found | North Grenville Hot Tubs", "That page isn't here.",
         """<section class="lhero"><div class="wrap" style="padding-block:96px">
  <p class="eyebrow">Page not found</p><h1>That page took a dip.</h1>
  <p style="color:var(--sand);margin-top:18px;max-width:46ch">The page you're looking for isn't here. Head back home, or just text Blaine and ask.</p>
  <div class="ctas" style="display:flex;gap:12px;flex-wrap:wrap;margin-top:28px"><a class="btn btn-gold" href="/">Back to home</a><a class="btn btn-ghost" href="tel:+16132921786">Call Blaine</a></div>
</div></section>""", "/")
    posts = load_posts()
    page("blog/", "Blog: Straight talk about hot tubs | North Grenville Hot Tubs",
         "Hot tub advice from Blaine McAvoy, owner of North Grenville Hot Tubs in Kemptville: water care, buying tips and ownership.",
         blog_index(posts, "../"), "../")
    for p in posts:
        page(f"blog/{p['slug']}/", f"{p['title']} | North Grenville Hot Tubs", p["description"],
             post_body(p, "../../"), "../../", post_jsonld(p))
    # Email clients (Outlook especially) don't show WebP, so post images get a JPG twin for the emails.
    for p in posts:
        jpg = ROOT / "assets/img/email" / f"{p['image']}.jpg"
        if not jpg.exists():
            try:
                from PIL import Image
                jpg.parent.mkdir(parents=True, exist_ok=True)
                Image.open(ROOT / "assets/img" / f"{p['image']}.webp").convert("RGB").save(jpg, quality=82)
            except Exception as e:  # Pillow missing: emails fall back to the WebP image
                print("note: couldn't make email JPG:", e)
        p["email_image"] = f"{SITE['url']}/assets/img/email/{p['image']}.jpg" if jpg.exists() else f"{SITE['url']}/assets/img/{p['image']}.webp"
    (ROOT / "blog" / "feed.json").write_text(json.dumps({"posts": [
        {"slug": p["slug"], "title": p["title"], "description": p["description"], "date": p["date"],
         "url": f"{SITE['url']}/blog/{p['slug']}/", "image": p["email_image"]} for p in posts]}, indent=1))
    # Legal pages
    for slug, title, lead in [("privacy", "Privacy policy", "How we collect, use and protect your personal information."),
                              ("terms", "Terms of use", "The terms for using our website, customer portal and staff portal.")]:
        body = md_to_html((SRC / "legal" / f"{slug}.md").read_text())
        page(f"{slug}/", f"{title} | North Grenville Hot Tubs", lead,
             f'''<section class="phero"><div class="wrap"><p class="eyebrow">North Grenville Hot Tubs &amp; Saunas</p><h1>{title}</h1>
<p style="color:var(--sand);margin-top:12px">{lead} Last updated October 23, 2026.</p></div></section>
<div class="wrap"><div class="prose">{body}</div></div>''', "../")
    # Portal pages (not indexed by search engines)
    tubs_js = json.dumps([{"k": t["k"], "n": t["n"], "line": t["line"], "lineName": LINES[t["line"]]["name"], "seats": t["seats"],
                           "jets": t["jets"], "power": t["power"]} for t in TUBS])
    app_head = '<meta name="robots" content="noindex">\n'
    app_scripts = ["https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/dist/umd/supabase.js", "/assets/js/app.js"]
    for slug, title, js in [("login", "Sign in", "login"), ("staff", "Staff portal", "staff"), ("sign", "Sign your agreement", "sign"), ("portal", "Your portal", "portal")]:
        body = f"<script>window.NG_TUBS={tubs_js};</script>\n" + (SRC / "app" / f"{slug}.html").read_text()
        app, app_title = {"staff": ("staff", "NG Team"), "portal": ("portal", "My Hot Tub")}.get(slug, ("manifest", "NG Hot Tubs"))
        page(f"{slug}/", f"{title} | North Grenville Hot Tubs", "North Grenville Hot Tubs customer and staff portal.", body, "../", app_head,
             app_scripts + [f"/assets/js/{js}.js"], app=app, app_title=app_title)
    # Offline page, shown by sw.js when the phone has no connection
    page("offline/", "You're offline | North Grenville Hot Tubs", "No connection right now.", (SRC / "offline.html").read_text(), "../", app_head)
    urls = [""] + [f"{l}/" for l in LINES] + [f"{t['line']}/{t['k']}/" for t in TUBS] + [f"{sid}/" for sid in SWIM["sections"]] + [f"{m['section']}/{m['k']}/" for m in SWIM_MODELS] + ["saunas/"] + [f"saunas/{m['k']}/" for m in SAUNA_MODELS] + ["blog/", "privacy/", "terms/"] + [f"blog/{p['slug']}/" for p in posts]
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{SITE['url']}/{u}</loc></url>\n" for u in urls) + "</urlset>\n")
    print(f"Built: home, {len(LINES)} line pages, {len(TUBS)} tub pages, {len(SWIM_MODELS)} swim spa and mini pool pages, {len(SAUNA_MODELS)} sauna pages, blog index, {len(posts)} posts, 404, sitemap")


if __name__ == "__main__":
    build()
