# Scott Lind Electric — website

Static marketing site for Scott Lind Electric LLC, Idaho Falls, ID.

Implemented from the Claude Design source `Scott Lind Electric Site.dc.html`
(kept for reference in [`design-src/`](design-src/)). The design is a single
prototype file that switches between nine "pages" with JavaScript; this is the
production build of it — nine real HTML pages at nine real URLs, which is what
the design's own SEO notes were asking for. A JS-toggled single page cannot
rank for "electrician in Ammon" because there is nothing at an Ammon URL to
rank.

---

## Quick start

```bash
node build.js
```

That's the whole toolchain — no dependencies, no install step. It reads `src/`
and `static/` and writes plain HTML into `dist/`.

To preview locally (the pages use root-absolute paths like `/assets/...`, so
open them through a server, not by double-clicking the file):

```bash
node build.js && cd dist && python3 -m http.server 4321
```

Then visit <http://localhost:4321>.

---

## Layout

```
build.js              the whole build — ~200 lines, zero dependencies
src/
  site.json           business facts: name, address, phone, nav, footer links
  layout.html         <head>, <body> shell, meta, JSON-LD slot
  partials/           header.html, footer.html
  pages/*.html        one file per page, JSON front matter + body
static/               copied verbatim into dist/
  assets/css/design-system.css   imported design system (tokens + components)
  assets/css/site.css            site layout, responsive rules
  assets/js/site.js              progressive enhancement only
  images/sle-logo.png
dist/                 generated — safe to delete, never edit by hand
design-src/           the original Claude Design files, for reference
```

### Why a build step for nine pages

Because the header, the footer, and the phone number appear on all nine. Without
it, changing the phone number is nine edits and one of them gets missed. The
*output* is still ordinary static HTML; nothing about the deployed site needs
Node.

### Editing content

- **Business facts** (phone, address, nav labels, footer links) → `src/site.json`.
  They flow into every page and into the structured data.
- **Page copy** → `src/pages/<page>.html`. Each file opens with a JSON comment
  holding its title, meta description and slug, then plain HTML for the body.
- **Header / footer** → `src/partials/`.

Templating is deliberately tiny: `{{key}}` substitutes, `{{> partial}}`
includes, and `{{#key}}…{{/key}}` / `{{^key}}…{{/key}}` switch a block on a
flag. That is all it does, on purpose — logic belongs in `build.js`, not in
the markup.

### Structured data writes itself

`build.js` emits an `Electrician` (LocalBusiness) block on every page, a
`BreadcrumbList` on every subpage, a `Service` block where the front matter
declares one, and a `FAQPage` built by **reading the questions out of the page
markup**. Any `<div class="faq-item">` or `<div class="qa-item">` holding an
`<h3>` and a `<p>` becomes one question. Write the question once, in the page,
and the schema follows it — there is no second copy to drift.

Currently: 16 questions on Answers, 4 each on Home, Residential, Commercial and
After Hours, 2 on Ammon.

`sitemap.xml` and `robots.txt` are generated too.

---

## Content still to supply

The design shipped with deliberate blanks. They are still blank — inventing
this content would be worse than leaving it visible, and two of these items
would be actively harmful if made up.

| What | Where | Notes |
|---|---|---|
| **Google reviews** | `src/pages/reviews.html`, `index.html` | Eight placeholder cards. Paste real reviews word for word from the Google Business Profile, with the customer's name and town. **Do not write review text.** Fabricated reviews are an FTC problem, not just an SEO one. Do not add `AggregateRating` schema for reviews hosted on Google. |
| **Idaho contractor licence number** | `src/pages/about.html` | Row reads "Add license number". The About page is the E-E-A-T page — a real licence number is the single highest-value thing you can add to it. |
| **Business hours** | `src/pages/contact.html` | Row reads "Confirm business hours". Once confirmed, also add `openingHoursSpecification` to `businessSchema()` in `build.js` so "open now" searches can surface the business. |
| **Photos** (6) | hero van, 3 job-site shots, Scott/crew, 2 maps | Each slot renders a labelled placeholder at the right aspect. Replace the `<div class="fig-ph">…</div>` with `<img src="/images/…" alt="…">` and the duotone treatment switches itself back on automatically. Real job-site photos from Idaho Falls beat stock — they carry location signal that stock does not. |
| **Google review link** | `src/site.json` → `reviewUrl` | The "Review us on Google" button points at a placeholder `placeid`. Grab the short link from the Business Profile. |
| **Estimate form endpoint** | `src/site.json` → `formEndpoint` | See below. |

Also worth doing before launch: check that the name, address and phone in
`src/site.json` match the Google Business Profile **character for character**.
Inconsistent NAP is the most common local-SEO own-goal.

### Wiring up the estimate form

There is no backend here. Until `formEndpoint` in `src/site.json` points at a
real form service (Formspree, Basin, Netlify Forms, Getform — any of them takes
a plain POST), the build **replaces both form slots with a "call us" panel**
and says so in its output:

```
note: formEndpoint is not configured — rendering call-us panels instead of forms
```

That is on purpose. A form whose action is a placeholder would POST to a 404 and
silently eat the customer's message — on a site whose whole promise is "you'll
reach a person", losing an enquiry is the worst failure available. Set the
endpoint and both forms appear, with a honeypot field, an inline success state,
and a graceful fallback to a normal POST if the fetch fails.

---

## Deploying

`dist/` is the site. Upload it to any static host — Netlify, Cloudflare Pages,
GitHub Pages, S3, or plain shared hosting.

Two things to set on the host:

1. **Serve from the domain root.** Links are root-absolute (`/residential.html`).
2. **Update `url` in `src/site.json`** if the domain is not
   `https://scottlindelectric.com/` — it drives canonicals, Open Graph URLs,
   the sitemap and the schema `@id`.

---

## What changed from the imported design

Faithful to the design's look; four deliberate departures, all of which the
design would have needed before it could be a real site:

1. **Nine pages instead of one.** Each `sc-if` block became its own URL, with
   its own title, description, canonical and schema.
2. **Responsive.** The design has no breakpoints — its grids are fixed
   `1.15fr .85fr`-style tracks that collapse badly under ~900px. Everything
   degrades to a single column, the seven-item nav folds behind a Menu toggle
   below 1000px, and the wide comparison tables scroll inside their own box
   rather than pushing the page sideways. Verified: no horizontal overflow at
   375 / 768 / 1280px on any page.
3. **Inline styles became classes.** The design carries layout in `style="..."`
   on every element. Same visual result, but a change now lands in one place.
   While consolidating, body-copy opacity that drifted between 72% / 74% / 76% /
   78% on visually identical paragraphs was collapsed to two steps — the
   difference is not perceptible and the drift was not load-bearing.
4. **Blueprint corner marks are visible on dark surfaces.** The design system
   draws them at 55% of `--color-text` (near-black), so on the accent-900 band
   and the dark cards they were dark-on-dark and disappeared. They now flip to
   the page ground on dark surfaces.

Plus the ordinary production work the prototype had no reason to carry: a skip
link, `aria-current` on the active nav item, table captions and `scope`
attributes, `:focus-visible` rings, `prefers-reduced-motion`, form labels and
autocomplete hints, Open Graph tags, and a print stylesheet.

### Notes

- Fonts (Barlow / Barlow Condensed) load from Google Fonts via `<link>` with
  preconnect, rather than the design's `@import`, which would block rendering
  until the stylesheet had parsed. To drop the third-party request entirely,
  self-host the two families in `static/assets/fonts/` and swap the `<link>` in
  `src/layout.html` for `@font-face` rules.
- The CSS uses `color-mix()` and `:has()`. Both are supported in all current
  browsers (Chrome/Edge 111+, Safari 16.4+, Firefox 128+). Older browsers get
  a plainer but working page.
- `design-src/` holds the imported Claude Design files. Nothing in the build
  reads them; they are there so the design intent stays checkable.
