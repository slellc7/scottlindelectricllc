# Scott Lind Electric — website

Astro site for Scott Lind Electric LLC, Idaho Falls, ID.

Implemented from the Claude Design source `Scott Lind Electric Site.dc.html`
(kept for reference in [`design-src/`](design-src/)). The design is a single
prototype file that switches between nine "pages" with JavaScript; this is the
production build of it — real pages at real URLs, plus a blog.

---

## Quick start

```bash
npm install
npm run dev
```

Then <http://localhost:4321>.

| Command | What it does |
|---|---|
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Static build into `dist/` |
| `npm run preview` | Serve the built `dist/` locally |
| `npm run check` | Type-check `.astro` and `.ts` files |

---

## Layout

```
astro.config.mjs        site URL, sitemap, URL format
src/
  consts.ts             business facts, nav, footer links — edit here first
  content.config.ts     blog frontmatter schema
  data/
    faqs.ts             FAQ content (feeds both the page and the schema)
    reviews.ts          review slots — PLACEHOLDERS, see below
  layouts/Base.astro    <head>, header, footer, nav toggle, form JS
  components/           Header, Footer, Schema, FaqGrid, CtaBand, Figure, …
  pages/                one .astro file per route
  content/blog/         blog posts as markdown
  styles/               design-system.css (imported) + site.css (layout)
  assets/               images that get optimized (logo, photos)
public/                 copied verbatim — robots.txt, _redirects, favicon
design-src/             the original Claude Design files, for reference
```

### Editing content

- **Phone, address, nav, footer links** → `src/consts.ts`. One edit, every page.
- **Page copy** → `src/pages/<page>.astro`.
- **FAQs** → `src/data/faqs.ts`.
- **Blog posts** → a markdown file in `src/content/blog/`.

### Structured data writes itself

`Schema.astro` emits an `Electrician` (LocalBusiness) node on every page, plus
`BreadcrumbList`, `FAQPage`, `Service` and `BlogPosting` where relevant.

The FAQ schema is built from the same arrays that render the questions, so
there's no second copy to drift. Currently: 16 questions on Answers, 4 each on
Home / Residential / Commercial / After Hours, 2 on Ammon.

`sitemap-index.xml` and `/rss.xml` are generated at build time.

---

## The blog

Posts are markdown in `src/content/blog/`. Frontmatter is validated at build
time — a missing field or an over-long description **fails the build** rather
than shipping quietly:

```yaml
---
title: 'Why does my breaker keep tripping?'   # ≤ 70 chars
description: 'Sentence that becomes the meta description.'  # 80–165 chars
pubDate: 2026-08-13
updatedDate: 2026-09-01        # optional
tags: ['Troubleshooting']      # optional
draft: false                   # true = excluded from the build
heroImage: './breaker.jpg'     # optional, relative to the post
heroAlt: 'Description'         # required if heroImage is set
---
```

Post pages get an automatic contents list from their `##` headings, `BlogPosting`
schema, and an RSS entry.

### AI publishing loop

The intended flow, once you wire it up:

1. A scheduled GitHub Action calls the Anthropic API and writes a `.md` file.
2. It opens a **pull request** rather than pushing to `main`.
3. Netlify builds a deploy preview from the PR.
4. You read it, then merge.

Two things worth building in from the start: keep `draft: true` on generated
posts until reviewed, and check the slug against existing filenames before
writing — unattended generators repeat themselves quickly.

If you'd rather not touch git for routine edits, **Sveltia CMS** (or Decap) is
git-backed, reads a `config.yml`, and edits the same markdown files. Sveltia is
the better-maintained of the two.

---

## Content still to supply

The design shipped with deliberate blanks. They are still blank — inventing this
content would be worse than leaving it visible, and two of these would be
actively harmful if made up.

| What | Where | Notes |
|---|---|---|
| **Google reviews** | `src/data/reviews.ts` | Eight placeholder slots. Paste real reviews word for word from the Business Profile with the customer's name and town. **Do not write review text** — fabricated reviews are an FTC problem, not just an SEO one. Don't add `AggregateRating` schema for reviews hosted on Google. |
| **Idaho contractor licence number** | `src/pages/about.astro` | Row reads "Add license number". The highest-value single addition to the site. |
| **Business hours** | `src/pages/contact.astro` | Row reads "Confirm business hours". Then add `openingHoursSpecification` to `Schema.astro` so "open now" searches can surface the business. |
| **Photos** (6) | hero van, 3 job-site shots, Scott/crew, 2 maps | Drop the file in `src/assets/`, import it in the page, pass it to `<Figure src={...} alt="…">`. Astro then generates WebP + srcset, and the duotone treatment switches itself back on. |
| **Google review link** | `src/consts.ts` → `reviewUrl` | Placeholder `placeid`. |
| **Estimate form endpoint** | `src/consts.ts` → `formEndpoint` | See below. |

Before launch, check the name, address and phone in `src/consts.ts` match the
Google Business Profile **character for character**.

### Wiring up the estimate form

There is no backend. Until `formEndpoint` is a real form service (Formspree,
Basin, Netlify Forms, Getform — any that accepts a plain POST), both form slots
render a **call-us panel** instead.

That's deliberate. A form whose action is a placeholder would POST to a 404 and
silently eat the enquiry — on a site whose whole promise is "you'll reach a
person", losing one is the worst failure available. Set the endpoint and the
forms appear, with a honeypot field, an inline success state, and a fallback to
a normal POST if the fetch fails.

---

## Deploying

Netlify, connected to the GitHub repo. `netlify.toml` sets the build command,
publish directory and cache headers, so nothing needs filling in by hand.

`public/_redirects` maps every URL from the old ASP.NET site with a 301:

| Old | New |
|---|---|
| `/default.aspx` | `/` |
| `/Residential.aspx` | `/residential/` |
| `/commercial.aspx` | `/commercial/` |
| `/after_hours.aspx` | `/after-hours/` |
| `/free-estimates.aspx` | `/contact/` |
| `/same-day-services.aspx` | `/residential/` |

The old site was IIS, so its paths were case-insensitive; Netlify's are not, and
the casings that were actually linked are listed explicitly. Netlify handles
www→apex and http→https once the domain is attached.

If the domain moves elsewhere, update `site` in `astro.config.mjs` and `url` in
`src/consts.ts` — they drive canonicals, Open Graph URLs, the sitemap and the
schema `@id`.

---

## What changed from the imported design

Faithful to the design's look. Five deliberate departures:

1. **Real pages instead of one.** Each `sc-if` block became a route with its own
   title, description, canonical and schema — plus a blog the design didn't have.
2. **Responsive.** The design has no breakpoints; its fixed `1.15fr .85fr` tracks
   collapse badly under ~900px. Everything degrades to a single column, the nav
   folds behind a Menu toggle below 1000px, and wide comparison tables scroll
   inside their own box. Verified: no horizontal overflow at 375 / 768 / 1280px
   on any page.
3. **Inline styles became classes.** The design carries layout in `style="..."`
   on every element. Same result, one place to change it. While consolidating,
   body-copy opacity that drifted between 72% / 74% / 76% / 78% on visually
   identical paragraphs was collapsed to two steps — imperceptible, and the
   drift wasn't load-bearing.
4. **Blueprint corner marks are visible on dark surfaces.** The design system
   draws them at 55% of near-black `--color-text`, so on the accent-900 band and
   the dark cards they vanished. They now flip to the page ground.
5. **Clean URLs.** `/residential/` rather than `/residential.html`. Nothing had
   launched, and every old path is redirected regardless.

Plus the production work the prototype had no reason to carry: skip link,
`aria-current` on the active nav item, table captions and `scope` attributes,
`:focus-visible` rings, `prefers-reduced-motion`, form labels and autocomplete
hints, Open Graph tags, and a print stylesheet.

### Notes

- Fonts (Barlow / Barlow Condensed) load from Google Fonts via `<link>` with
  preconnect. To drop the third-party request, self-host the two families in
  `src/assets/fonts/` and swap the `<link>` in `Base.astro` for `@font-face`.
- The CSS uses `color-mix()` and `:has()` — supported in all current browsers
  (Chrome/Edge 111+, Safari 16.4+, Firefox 128+). Older browsers get a plainer
  but working page.
- `design-src/` holds the imported Claude Design files. Nothing in the build
  reads them; they're there so the design intent stays checkable.
