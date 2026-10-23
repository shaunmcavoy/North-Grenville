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

PHONE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>'
CHAT = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>'
TEL = f"tel:{SITE['phone_tel']}"
esc = html.escape


def sms(text):
    return esc(f"sms:{SITE['phone_tel']}?&body={quote(text)}")


def fill(s, base):
    s = s.replace("{{PHONE}}", PHONE).replace("{{CHAT}}", CHAT).replace("{{BASE}}", base)
    s = s.replace("{{IMG:brandLogo}}", f"{base}assets/img/logo.webp")
    return re.sub(r"\{\{IMG:([\w-]+)\}\}", lambda m: f"{base}assets/img/{m.group(1)}.webp", s)


def page(path, title, desc, body, base, extra_head=""):
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
<link rel="icon" type="image/png" href="{base}favicon.png">
<link rel="apple-touch-icon" href="{base}apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,500;0,700;1,500&family=Figtree:wght@400;500;600;700&display=swap">
<link rel="stylesheet" href="{base}assets/css/site.css">
{extra_head}</head>
<body>
"""
    header = fill((SRC / "header.html").read_text(), base)
    footer = fill((SRC / "footer.html").read_text(), base)
    out = head + header + '\n<main id="top">\n' + body + "\n</main>\n" + footer + f'\n<script src="{base}assets/js/site.js" defer></script>\n</body>\n</html>\n'
    target = ROOT / path / "index.html" if path and not path.endswith(".html") else ROOT / (path or "index.html")
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(out)
    assert "{{" not in out, f"unfilled token in {target}"
    return target


def card(t, base):
    flag = f'<span class="flag">{esc(t["flag"])}</span>' if t.get("flag") else ""
    return f"""<article class="tub" data-s="{t['s']}">
      <div class="ph"><img src="{base}assets/img/{t['k']}.webp" alt="{esc(t['n'])} hot tub seen from above" loading="lazy" width="560" height="560">{flag}</div>
      <div class="bd">
        <h3 class="tubname">The {esc(t['n'])}</h3>
        <div class="specs"><div><b>{t['seats']}</b><span>Seats</span></div><div><b>{t['jets']}</b><span>Jets</span></div><div><b>{t['power']}</b><span>Power</span></div></div>
        <p class="note">{esc(t['note'])}</p>
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
    moments = "".join(f"<article><h3>{esc(a)}</h3><p>{esc(b)}</p></article>" for a, b in L["moments"])
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
      <li><b>First soak, clean water</b><p>We set you up with O-Care and a weekly routine that takes minutes.</p></li>
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
  </div>
</div>
</article>"""


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
<section class="pick"><div class="wrap"><div class="postgrid">{cards}</div></div></section>"""


def build():
    home = fill((SRC / "home.html").read_text(), "")
    page("", "North Grenville Hot Tubs & Saunas | Kemptville, Ontario",
         "Family-owned hot tub store in Kemptville. Platinum Spas hot tubs, swim spas and saunas at wholesale prices. Call or text owner Blaine McAvoy at (613) 292-1786.",
         home, "", business_jsonld())
    for lid, L in LINES.items():
        page(f"{lid}/", f"{L['name']} Hot Tubs: {L['title'][:-1]} | North Grenville Hot Tubs", L["meta"], line_body(lid, "../"), "../")
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
    urls = [""] + [f"{l}/" for l in LINES] + ["blog/"] + [f"blog/{p['slug']}/" for p in posts]
    (ROOT / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
        + "".join(f"  <url><loc>{SITE['url']}/{u}</loc></url>\n" for u in urls) + "</urlset>\n")
    print(f"Built: home, {len(LINES)} line pages, blog index, {len(posts)} posts, 404, sitemap")


if __name__ == "__main__":
    build()
