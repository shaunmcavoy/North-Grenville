# North Grenville Hot Tubs & Saunas

Website for North Grenville Hot Tubs & Saunas, a family-owned hot tub store in Kemptville, Ontario. Owner: Blaine McAvoy, (613) 292-1786.

It's a plain static site: HTML, one stylesheet and a small script. There's no framework, and no build tools to install beyond Python 3.

## Pages

| Page | File |
| --- | --- |
| Home: story, the three lines, water care, service area | `index.html` |
| Deluxe line | `deluxe/index.html` |
| Premium line | `premium/index.html` |
| Luxury line | `luxury/index.html` |
| Not found | `404.html` |

## Editing content

Don't edit the generated `index.html` files directly. Edit the sources in `src/`, then rebuild:

- `src/data.json`: phone, address, every tub (seats, jets, power, note), and each line's copy (Blaine's belief, ownership moments, features).
- `src/home.html`: homepage sections.
- `src/header.html` and `src/footer.html`: shared across every page.
- `assets/css/site.css`: all styling. Colours and fonts are set at the top.

```sh
python3 build.py
```

## Images

Product photos in `assets/img/` come from Platinum Spas (manufacturer photos for authorized dealers). To add a tub, drop a square photo in `assets/img/<key>.webp`, add the tub to `src/data.json` with the same `k` key, and rebuild.

## Publishing

Any static host works: GitHub Pages, Netlify, Vercel or Cloudflare Pages. Point it at the repository root. Nothing needs to be built on the server, because the generated pages are committed.

The calls to action are `tel:` and `sms:` links to Blaine's direct line, so on a phone they open the dialler or messages app directly.
