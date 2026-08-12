#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════════════════
   Build a single self-contained HTML file from dist/, for sharing a draft.

   `node build.js && node preview.js` → preview/scott-lind-electric-preview.html

   This is ONLY for review links. It folds the nine real pages into one file
   with a client-side router so the whole site can travel as a single
   attachment or a single hosted page — which is the opposite of what the real
   site wants (nine URLs is the entire SEO point). Never deploy this file as
   the site; deploy dist/.

   Everything is embedded — fonts, logo, CSS, JS — so it renders identically
   with no network access at all.
   ═══════════════════════════════════════════════════════════════════════════ */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const OUT_DIR = path.join(ROOT, 'preview');

const PAGES = [
  ['index', '/', 'Home'],
  ['residential', '/residential.html', 'Residential'],
  ['commercial', '/commercial.html', 'Commercial'],
  ['after-hours', '/after-hours.html', 'After Hours'],
  ['ammon', '/ammon.html', 'Service Area'],
  ['answers', '/answers.html', 'Answers'],
  ['about', '/about.html', 'About'],
  ['reviews', '/reviews.html', 'Reviews'],
  ['contact', '/contact.html', 'Contact'],
];

const FONT_CSS_URL =
  'https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;700&family=Barlow+Condensed:wght@400;600&display=swap';
// A desktop-Chrome UA is what makes Google Fonts serve woff2 rather than ttf.
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/* ── fonts ───────────────────────────────────────────────────────────────── */

async function embeddedFontCss() {
  const css = await (await fetch(FONT_CSS_URL, { headers: { 'User-Agent': UA } })).text();

  // Google splits every weight across subsets (latin, latin-ext, cyrillic, …).
  // The site is English; keeping only the basic-latin block per weight takes
  // the payload from ~15 files to 5.
  const blocks = css.split('@font-face').slice(1).map((b) => '@font-face' + b.split('}')[0] + '}');
  const latin = blocks.filter((b) => /unicode-range:\s*U\+0000-00FF/.test(b));

  let out = '';
  let bytes = 0;
  for (const block of latin) {
    const url = block.match(/url\((https:\/\/fonts\.gstatic\.com[^)]+)\)/)[1];
    const buf = Buffer.from(await (await fetch(url)).arrayBuffer());
    bytes += buf.length;
    out +=
      block.replace(
        /url\(https:\/\/fonts\.gstatic\.com[^)]+\)/,
        `url(data:font/woff2;base64,${buf.toString('base64')})`
      ) + '\n';
  }
  console.log(`  fonts   ${latin.length} faces, ${(bytes / 1024).toFixed(0)} KB embedded`);
  return out;
}

/* ── page pieces ─────────────────────────────────────────────────────────── */

const read = (f) => fs.readFileSync(path.join(DIST, f), 'utf8');

const between = (s, start, end) => {
  const a = s.indexOf(start);
  const b = s.indexOf(end, a);
  if (a === -1 || b === -1) throw new Error(`could not slice between ${start} … ${end}`);
  return s.slice(a, b);
};

const mainOf = (s) => {
  const a = s.indexOf('<main id="main">') + '<main id="main">'.length;
  return s.slice(a, s.indexOf('</main>', a));
};

/* ── build ───────────────────────────────────────────────────────────────── */

(async () => {
  if (!fs.existsSync(DIST)) throw new Error('dist/ not found — run `node build.js` first');

  const index = read('index.html');

  const designCss = fs.readFileSync(path.join(DIST, 'assets/css/design-system.css'), 'utf8');
  const siteCss = fs.readFileSync(path.join(DIST, 'assets/css/site.css'), 'utf8');
  const siteJs = fs.readFileSync(path.join(DIST, 'assets/js/site.js'), 'utf8');

  const logo = fs.readFileSync(path.join(DIST, 'images/sle-logo.png'));
  const logoUri = `data:image/png;base64,${logo.toString('base64')}`;

  const fontCss = await embeddedFontCss();

  // Header + footer are identical on every page; take them from the home page
  // and drop the baked-in aria-current, which the router now owns.
  const chrome = between(index, '<a class="skip-link"', '<main id="main">').replace(
    / aria-current="page"/g,
    ''
  );
  const footer = between(index, '</main>', '</div>\n<script').replace('</main>', '');

  const sections = PAGES.map(([slug, href]) => {
    const file = slug === 'index' ? 'index.html' : `${slug}.html`;
    return `<div class="pv-page" data-page="${slug}" hidden>\n${mainOf(read(file))}\n</div>`;
  }).join('\n\n');

  const routes = JSON.stringify(Object.fromEntries(PAGES.map(([slug, href]) => [href, slug])));

  const styles = `<style>
${fontCss}
${designCss}
${siteCss}
/* Preview-only: the router shows one page at a time. */
.pv-page[hidden] { display: none !important; }
</style>`;

  const body = `<div class="page">
${chrome.replace(/src="\/images\/sle-logo\.png"/g, `src="${logoUri}"`)}
<main id="main">
${sections}
</main>
${footer.replace(/src="\/images\/sle-logo\.png"/g, `src="${logoUri}"`)}
</div>

<script>
/* Client-side router — preview only. The real site at dist/ has nine URLs. */
(function () {
  var ROUTES = ${routes};
  var pages = document.querySelectorAll('.pv-page');
  var navLinks = document.querySelectorAll('.nav-main a');

  function show(slug, push) {
    var found = false;
    pages.forEach(function (p) {
      var match = p.dataset.page === slug;
      p.hidden = !match;
      if (match) found = true;
    });
    if (!found) return show('index', push);

    navLinks.forEach(function (a) {
      var target = ROUTES[a.getAttribute('href')];
      if (target === slug) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
    });

    document.title =
      (slug === 'index' ? 'Home' : slug.replace(/-/g, ' ')) + ' — Scott Lind Electric preview';
    if (push) location.hash = '#/' + slug;
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="/"]');
    if (!a || a.getAttribute('href').charAt(1) === '/') return;
    var slug = ROUTES[a.getAttribute('href')];
    if (!slug) return;
    e.preventDefault();
    show(slug, true);
    var nav = document.getElementById('site-nav');
    var toggle = document.querySelector('[data-nav-toggle]');
    if (nav) nav.setAttribute('data-open', 'false');
    if (toggle) toggle.setAttribute('aria-expanded', 'false');
  });

  window.addEventListener('hashchange', function () {
    show((location.hash.replace('#/', '') || 'index'), false);
  });

  show(location.hash.replace('#/', '') || 'index', false);
})();
</script>
<script>
${siteJs}
</script>
`;

  fs.mkdirSync(OUT_DIR, { recursive: true });

  // 1. Standalone document — drag onto Netlify Drop, e-mail, or just open.
  const standalone = `<!DOCTYPE html>
<html lang="en-US">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Scott Lind Electric — site preview</title>
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="${logoUri}">
${styles}
</head>
<body>
${body}</body>
</html>
`;

  // 2. Fragment — the Artifact host supplies its own doctype/head/body, so
  //    this form carries only <title>, <style> and content.
  const fragment = `<title>Scott Lind Electric — site preview</title>
${styles}
${body}`;

  const files = [
    ['scott-lind-electric-preview.html', standalone],
    ['artifact.html', fragment],
  ];
  console.log(`  pages   ${PAGES.length} folded into one file`);
  for (const [name, content] of files) {
    fs.writeFileSync(path.join(OUT_DIR, name), content);
    console.log(`  written preview/${name.padEnd(34)} ${(content.length / 1024).toFixed(0)} KB`);
  }
})();
