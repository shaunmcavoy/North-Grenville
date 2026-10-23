# North Grenville Hot Tubs website

Static site for North Grenville Hot Tubs & Saunas (Kemptville, ON), live at https://northgrenvillehottubs.ca via GitHub Pages from `main` (root). Owner: Blaine McAvoy. Site run by his brother Shaun McAvoy.

- Never hand-edit generated pages (`index.html`, `deluxe/`, `premium/`, `luxury/`, `blog/`, `404.html`, `sitemap.xml`). Edit `src/` and run `python3 build.py`, then commit both.
- Content: `src/data.json` (site facts, lines, tubs), `src/home.html`, `src/header.html`, `src/footer.html`, `src/posts/*.md` (blog).
- Styles: `assets/css/site.css`. Images: `assets/img/*.webp`.
- Weekly blog posts follow `docs/BLOG_GUIDE.md` exactly.
- Copy rules: no em dashes, Canadian spelling, Blaine's warm plain voice, no invented prices, statistics, reviews or customer stories.
- Keep `CNAME` (custom domain). Don't touch DNS.
- **Every message to customers explains why.** Each email, page or notice we send (sign-up confirmations, blog emails, welcome, delivery, maintenance reminders, warranty updates) says in Blaine's voice why it's good for the customer and why North Grenville does it this way (clean simple water, a tub that lasts, more time with family, honest advice). Never send a bare transactional message.
