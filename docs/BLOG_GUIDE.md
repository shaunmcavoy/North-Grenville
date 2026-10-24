# Weekly blog guide

Every Monday a new post goes up at northgrenvillehottubs.ca/blog/, written in Blaine McAvoy's voice and published under his name with his permission. This guide is the brief. Follow it exactly, every week.

## Why the blog exists

To answer the real questions people around Kemptville and North Grenville type into Google before buying a hot tub, and to answer them the way Blaine would across the counter. A post earns its place only if a local buyer would be glad they read it. Google rewards that, and pushes down thin posts written only for keywords.

## Who Blaine is (facts you may use)

- Owner of North Grenville Hot Tubs & Saunas, a small, family-owned warehouse store at 5333 County Rd 19, Kemptville. Visits by appointment.
- Has sold hot tubs for more than 15 years, working on contract for other dealers before opening his own store.
- Saw dealers steer people away from the best tub for them because the real money came from selling chemicals for years afterwards. Opened his store to do the opposite.
- Believes a hot tub should be a healthy, stress-free place to unplug from screens, news and media, and reconnect with family, body and mind. Not a chore. Not water that's unhealthy to soak in.
- Orders through Platinum Spas' own supply chain instead of stocking a big lot, so he's motivated to sell the tub that fits you, not the one in stock. Low overhead means better tubs at better (wholesale) prices.
- Recommends O-Care, a weekly mineral-salt treatment, as "the hot tub diet": fewer chemicals, less scale and biofilm, a tub that lasts longer. Local water is hard.
- Sells Platinum Spas hot tubs in three lines (Deluxe, Premium, Luxury), plus swim spas, the Chronos mini pool and infrared saunas.
- Direct line, call or text: (613) 292-1786. He answers it himself.
- Serves Kemptville and the hamlets of North Grenville: Burritts Rapids, Oxford Mills, Oxford Station, Bishops Mills, Heckston, Peltons Corners, and the smaller communities around them.

Product facts (seats, jets, power, features, sizes, pumps) come only from `src/data.json` and `src/specs.json` (Platinum Spas' published specs). Don't add specs that aren't there.

## Voice

- First person, as Blaine. Warm, plain-spoken, calm and honest. Like a neighbour who knows hot tubs inside out.
- Short sentences. Everyday words. Explain any technical term the first time.
- Willing to say "you don't need that" or "a cheaper tub will do".
- Canadian spelling: colour, centre, neighbour, litre.
- **No em dashes, ever.** Use a period or a comma instead.
- No hype, no fake urgency, no "deal of a lifetime", no exclamation marks in a row.
- Avoid stock AI phrasing: "In today's fast-paced world", "dive in", "game-changer", "elevate", "unlock", "it's important to note", "in conclusion".

## Hard rules (never break these)

1. **No invented people or events.** No made-up customer stories, quotes, testimonials, reviews, names, or "last week a family in Oxford Mills…". Speak in general terms ("a lot of people ask me…").
2. **No invented numbers.** No statistics, percentages, prices, costs, savings or study results unless they're in `src/data.json` or `src/specs.json` or are common, verifiable physical facts (like water boiling at 100°C). If a number would help, describe it in words instead.
3. **No prices.** Price questions always go to "text me and I'll give you a real number."
4. **No medical claims.** Say people find soaking relaxing or good for sore muscles. Never say it treats, cures or prevents anything. For health conditions, pregnancy or medications, say to check with their doctor.
5. **No knocking competitors by name.** Talk about "a lot of dealers" in general, as Blaine does.
6. **Water safety stays accurate.** If you give chemistry or safety guidance (pH range, sanitizer, temperature limits, kids), keep it conservative and mainstream, and tell people to follow their tub's manual and the product label.

## Shape of every post

- **Length:** 700 to 1,000 words.
- **Title:** under 60 characters, the way a local would search it. Example: "How often should you change hot tub water?"
- **Description:** one sentence under 155 characters. It shows in Google results.
- **Opening:** two or three sentences that answer the question straight away. No warm-up.
- **Body:** 3 to 5 `##` sections, each answering one part of the question. Use a short list only when it helps.
- **Local touch:** mention Kemptville or North Grenville naturally once or twice, and hard water or Ontario winters when it's relevant. Don't stuff place names.
- **Internal links:** link to one or two relevant site pages using root-relative links:
  - `/deluxe/`, `/premium/`, `/luxury/` for the lines
  - a single tub's page, like `/premium/maximus/` or `/deluxe/tahiti/`, when a post talks about that model
  - `/#diet` for water care and O-Care
  - When a post tells owners to start or keep using O-Care, link Blaine's O-Care registration: https://l.ead.me/bgkT4n (O-CareComfort sign-up with North Grenville as the dealer; customers choose Blaine McAvoy as their advisor). Say why: delivered free to the door, a saving on every box, never run out, pause or cancel any time.
  - `/#story` for Blaine's story
  - an earlier post at `/blog/<slug>/` when it fits
- **Ending:** one short closing paragraph in Blaine's voice. The page adds the call/text box itself, so don't repeat the phone number at the end.

## File format

Create `src/posts/YYYY-MM-DD-slug.md`, where the date is the Monday the post is published and the slug is the title in lowercase words joined by hyphens.

```
---
title: How often should you change hot tub water?
description: How often to drain and refill a hot tub in hard-water North Grenville, and how to make the water last longer between changes.
date: 2026-10-26
image: palma
---

Body in Markdown. Use ## for section headings.
```

`image` is the name of a photo in `assets/img/` without `.webp`. Pick one that fits and isn't used by the last three posts. Available: tahiti, st-lucia, reims, refresh, palma, st-tropez, seville, topaz, barcelona, maximus, santorini, tokyo, colombo, oslo, capri, portofino, positano, florence, palermo, sicily, hero-night, swim, chronos.

Supported Markdown: `##` and `###` headings, paragraphs, `-` and `1.` lists, `>` quotes, `**bold**`, `*italic*`, `[links](/path/)`.

## Choosing the topic

1. List `src/posts/` to see what's been published. Never repeat a topic or a near-duplicate title.
2. Pick the first unused topic from the bank below that suits the season (Toronto time). If none fits the season, take the first unused one.
3. If every topic is used, write a new one in the same spirit and add it to the bank in this file.

## Topic bank

**Water care and maintenance**
- How often should you change hot tub water?
- Hot tub care in hard water: what North Grenville owners should know
- The hot tub diet: why fewer chemicals makes a tub last longer
- What is biofilm, and why does it matter in your hot tub?
- How to clean hot tub filters (and when to replace them)
- Why is my hot tub water cloudy? The usual causes
- Foamy hot tub water: what causes it and how to stop it
- A simple weekly hot tub routine that takes 10 minutes
- Ozone, UV and mineral systems explained in plain English

**Buying a hot tub**
- How to choose the right hot tub size for your family
- Loungers or all-seaters: which hot tub layout is right for you?
- 120V plug-and-play vs 240V hot tubs: which do you need?
- Deluxe, Premium or Luxury: how to pick a Platinum Spas line
- What to ask before you buy a hot tub
- Why sitting in a tub before you buy matters (the wet test)
- Why I order your hot tub instead of selling what's in stock
- Hot tub or swim spa: which one fits your backyard?
- What actually makes a hot tub energy efficient?

**Getting ready for delivery**
- Where should you put your hot tub? Picking the right spot
- What base does a hot tub need? (Hint: concrete is not the only option)
- How a hot tub gets delivered: what to expect on the day
- Getting power to your hot tub: talking to your electrician

**Living with a hot tub**
- Using your hot tub in an Ontario winter
- How to keep hot tub running costs down in winter
- Getting your family to put the phones down: the hot tub habit
- Hot tubs and sleep: why an evening soak helps people unwind
- Hot tubs for sore muscles after work or a game
- Kids and hot tubs: simple safety rules
- Hot tub etiquette for guests and get-togethers
- Hot and cold: pairing a sauna with your hot tub
- How long should you stay in a hot tub?

**Seasonal**
- Spring hot tub checklist after a long winter (March to April)
- Summer hot tub tips: keeping water fresh in the heat (June to August)
- Fall hot tub prep before the cold sets in (September to October)
- Is winter a good time to buy a hot tub? (November to January)

## Publishing steps

1. Write the post file as above.
2. Run `python3 build.py`. It must finish without errors.
3. Check the new page exists at `blog/<slug>/index.html`, that the post has no em dashes (`grep -c "—"` returns 0), and that the word count is in range.
4. Commit with a message like `Blog: <title>` and push to `main`. GitHub Pages publishes it within a few minutes.
