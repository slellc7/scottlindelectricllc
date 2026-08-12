#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Scott Lind Electric — static site build.

   No dependencies, no framework, no install step. `node build.js` reads
   src/ + static/ and writes a folder of plain HTML into dist/ that can be
   dropped on any host.

   Why a build step at all, for nine pages? Because the header, the footer and
   the business's name/address/phone appear on every one of them. Without this,
   changing the phone number is nine edits and one of them gets missed. The
   output is still ordinary static HTML — nothing about the deployed site
   depends on Node.

   Templating is deliberately tiny:
     {{key}}          substitute from the page context (raw HTML)
     {{> partial}}    inline src/partials/<partial>.html

   Structured data is derived from the page markup rather than declared twice:
   any <div class="faq-item"> or <div class="qa-item"> holding an <h3> and a
   <p> becomes one Question in that page's FAQPage schema. Write the question
   once, in the page, and the schema follows it.
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const STATIC = path.join(ROOT, 'static');
const DIST = path.join(ROOT, 'dist');

const site = JSON.parse(fs.readFileSync(path.join(SRC, 'site.json'), 'utf8'));

/* The estimate form is only rendered once site.json points at a real endpoint.
   A form whose action is still the placeholder would POST to a 404 and eat the
   customer's message — on a site whose entire promise is "you'll reach a
   person", silently losing an enquiry is the worst possible failure. Until it
   is wired, every form slot renders a call-us panel instead. */
site.formEnabled = Boolean(site.formEndpoint) && !/REPLACE_ME/.test(site.formEndpoint);
if (!site.formEnabled) {
  console.log('  note: formEndpoint is not configured — rendering call-us panels instead of forms\n');
}

/* ── helpers ─────────────────────────────────────────────────────────────── */

const esc = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** Strip markup and collapse whitespace — for schema/meta text. */
const plain = (html) =>
  String(html)
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;| |‑/g, (m) => (m === '&nbsp;' || m === ' ' ? ' ' : '-'))
    .replace(/\s+/g, ' ')
    .trim();

const rmrf = (p) => fs.rmSync(p, { recursive: true, force: true });

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

/* ── front matter ────────────────────────────────────────────────────────── */

/** Pages open with a JSON block inside an HTML comment: <!--{ ... }--> */
function readPage(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const m = raw.match(/^\s*<!--(\{[\s\S]*?\})-->\s*/);
  if (!m) throw new Error(`${path.basename(file)}: missing front-matter comment`);
  let meta;
  try {
    meta = JSON.parse(m[1]);
  } catch (e) {
    throw new Error(`${path.basename(file)}: front matter is not valid JSON — ${e.message}`);
  }
  return { meta, body: raw.slice(m[0].length) };
}

/* ── structured data ─────────────────────────────────────────────────────── */

const businessSchema = () => ({
  '@type': 'Electrician',
  '@id': site.url + '#business',
  name: site.legalName,
  url: site.url,
  telephone: site.telephoneE164,
  image: site.url + site.logo.replace(/^\//, ''),
  address: {
    '@type': 'PostalAddress',
    streetAddress: site.address.street,
    addressLocality: site.address.city,
    addressRegion: site.address.region,
    postalCode: site.address.postalCode,
    addressCountry: site.address.country,
  },
  areaServed: site.areaServed.map((name) => ({ '@type': 'City', name })),
  description: site.description,
  makesOffer: site.services.map((name) => ({
    '@type': 'Offer',
    itemOffered: { '@type': 'Service', name },
  })),
});

/** Pull question/answer pairs straight out of the rendered page markup. */
function extractFaq(html) {
  const out = [];
  const block = /<div class="(?:faq-item|qa-item)[^"]*"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>\s*<p[^>]*>([\s\S]*?)<\/p>/g;
  let m;
  while ((m = block.exec(html)) !== null) {
    const q = plain(m[1]);
    const a = plain(m[2]);
    if (q && a) out.push({ q, a });
  }
  return out;
}

function buildJsonLd(meta, contentHtml, canonical) {
  const graph = [businessSchema()];

  if (meta.slug !== 'index') {
    graph.push({
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: site.url },
        { '@type': 'ListItem', position: 2, name: meta.breadcrumb || meta.navLabel, item: canonical },
      ],
    });
  }

  const faq = extractFaq(contentHtml);
  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': canonical + '#faq',
      mainEntity: faq.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    });
  }

  if (meta.serviceSchema) {
    graph.push({
      '@type': 'Service',
      name: meta.serviceSchema.name,
      serviceType: meta.serviceSchema.name,
      url: canonical,
      provider: { '@id': site.url + '#business' },
      areaServed: site.areaServed.map((name) => ({ '@type': 'City', name })),
      description: meta.description,
    });
  }

  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2);
}

/* ── nav ─────────────────────────────────────────────────────────────────── */

function navHtml(currentSlug) {
  return site.nav
    .map(({ slug, label, href }) => {
      const current = slug === currentSlug ? ' aria-current="page"' : '';
      return `<a href="${href}"${current}>${label}</a>`;
    })
    .join('\n        ');
}

function linkList(items, currentSlug) {
  return items
    .map(({ label, href, slug }) => {
      const current = slug && slug === currentSlug ? ' aria-current="page"' : '';
      return `<a href="${href}"${current}>${label}</a>`;
    })
    .join('\n            ');
}

/* ── render ──────────────────────────────────────────────────────────────── */

const partials = {};
for (const f of fs.readdirSync(path.join(SRC, 'partials'))) {
  partials[path.basename(f, '.html')] = fs.readFileSync(path.join(SRC, 'partials', f), 'utf8');
}

const lookup = (ctx, key) => key.split('.').reduce((o, k) => (o == null ? o : o[k]), ctx);

/**
 * {{> partial}} first (so partials may use {{vars}}), then sections, then vars.
 *
 * Sections are Mustache-shaped and boolean only — enough to switch a block on
 * a flag, deliberately not enough to grow logic into the templates:
 *   {{#key}} … {{/key}}   render when key is truthy
 *   {{^key}} … {{/key}}   render when key is falsy
 */
function render(template, ctx) {
  let out = template.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`unknown partial: ${name}`);
    return partials[name];
  });

  for (let pass = 0; pass < 5; pass++) {
    const before = out;
    out = out.replace(
      /\{\{([#^])\s*([\w.]+)\s*\}\}([\s\S]*?)\{\{\/\s*\2\s*\}\}/g,
      (_, kind, key, body) => {
        const truthy = Boolean(lookup(ctx, key));
        return (kind === '#') === truthy ? body : '';
      }
    );
    if (out === before) break;
  }

  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (whole, key) => {
    const val = lookup(ctx, key);
    if (val == null) throw new Error(`unresolved template variable: {{${key}}}`);
    return String(val);
  });
  const leftover = out.match(/\{\{[^}]*\}\}/);
  if (leftover) throw new Error(`unresolved template expression: ${leftover[0]}`);
  return out;
}

const layout = fs.readFileSync(path.join(SRC, 'layout.html'), 'utf8');

rmrf(DIST);
copyDir(STATIC, DIST);

const pageFiles = fs
  .readdirSync(path.join(SRC, 'pages'))
  .filter((f) => f.endsWith('.html'))
  .sort();

const built = [];

for (const file of pageFiles) {
  const { meta, body } = readPage(path.join(SRC, 'pages', file));
  const slug = meta.slug || path.basename(file, '.html');
  const outName = slug === 'index' ? 'index.html' : `${slug}.html`;
  const canonical = site.url + (slug === 'index' ? '' : outName);

  const content = render(body, { site });

  const ctx = {
    site,
    title: esc(meta.title),
    description: esc(meta.description),
    canonical,
    ogType: meta.slug === 'index' ? 'website' : 'article',
    bodyClass: meta.bodyClass || `page-${slug}`,
    content,
    jsonld: buildJsonLd(meta, content, canonical),
    nav: navHtml(slug),
    footServices: linkList(site.footer.services, slug),
    footCompany: linkList(site.footer.company, slug),
    year: String(new Date().getFullYear()),
  };

  const html = render(layout, ctx);
  fs.writeFileSync(path.join(DIST, outName), html);
  built.push({ outName, canonical, priority: meta.priority || '0.7' });
  console.log(`  ${outName.padEnd(20)} ${(html.length / 1024).toFixed(1)} KB`);
}

/* ── sitemap + robots ────────────────────────────────────────────────────── */

const today = new Date().toISOString().slice(0, 10);
const sitemap =
  `<?xml version="1.0" encoding="UTF-8"?>\n` +
  `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
  built
    .map(
      (p) =>
        `  <url>\n    <loc>${p.canonical}</loc>\n    <lastmod>${today}</lastmod>\n` +
        `    <priority>${p.priority}</priority>\n  </url>`
    )
    .join('\n') +
  `\n</urlset>\n`;
fs.writeFileSync(path.join(DIST, 'sitemap.xml'), sitemap);

fs.writeFileSync(
  path.join(DIST, 'robots.txt'),
  `User-agent: *\nAllow: /\n\nSitemap: ${site.url}sitemap.xml\n`
);

console.log(`\n  ${built.length} pages + sitemap.xml + robots.txt -> dist/`);
