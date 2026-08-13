# Job photos

Drop image files in this folder. That's the whole process.

They are picked up automatically by `src/components/Gallery.astro`, converted to
WebP with responsive `srcset`, and appear on `/work/` and in the home-page strip.
No code change needed.

**Then describe them.** Add an entry to `src/data/gallery.ts` keyed by the
filename without its extension:

```ts
'panel-swap-ammon': {
  alt: 'Open electrical panel with new breakers installed, Ammon home',
  caption: 'Panel replacement, Ammon',
  category: 'Residential',
  feature: true,   // gives it the wide slot in the grid
},
```

A photo without an entry still renders, but with generic alt text — the build
prints a warning listing anything undescribed.

## Notes

- **Filenames set the order** (after featured items): prefix with `01-`, `02-`
  if you want a specific sequence.
- **Send originals, not phone-compressed copies.** Astro resizes down well and
  cannot invent detail. 2000px on the long edge is plenty.
- **Formats:** `.jpg`, `.jpeg`, `.png`, `.webp`, `.avif`.
- **Don't put photos in `public/`** — files there are copied verbatim and skip
  optimization entirely.
