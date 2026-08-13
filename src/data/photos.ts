import type { ImageMetadata } from 'astro';
import { photoMeta, genericAlt, titleFromFilename, type PhotoMeta } from './gallery';

/**
 * Reads every image in src/assets/photos/ at build time.
 *
 * Lives in its own module so pages can ask "are there any photos yet?" and
 * decide whether to render a section at all — rather than the Gallery component
 * printing a developer-facing empty state into a page a customer is reading.
 */
export type Photo = PhotoMeta & {
  name: string;
  src: ImageMetadata;
  alt: string;
  caption: string;
};

const files = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/photos/*.{jpg,jpeg,png,webp,avif}',
  { eager: true }
);

export const photos: Photo[] = Object.entries(files)
  .map(([path, mod]) => {
    const name = path.split('/').pop()!.replace(/\.[^.]+$/, '');
    const meta = photoMeta[name] ?? {};
    return {
      ...meta,
      name,
      src: mod.default,
      alt: meta.alt ?? genericAlt,
      caption: meta.caption ?? titleFromFilename(name),
    };
  })
  // Featured first, then by filename — so a `01-`, `02-` prefix controls order.
  .sort(
    (a, b) =>
      Number(b.feature ?? false) - Number(a.feature ?? false) || a.name.localeCompare(b.name)
  );

export const hasPhotos = photos.length > 0;

const undescribed = Object.entries(files)
  .map(([p]) => p.split('/').pop()!.replace(/\.[^.]+$/, ''))
  .filter((name) => !photoMeta[name]?.alt);

if (undescribed.length) {
  console.warn(
    `\n  [photos] ${undescribed.length} photo(s) have no alt text and fall back to generic wording.` +
      `\n  Add entries to src/data/gallery.ts for: ${undescribed.join(', ')}\n`
  );
}

/**
 * The home-page hero photograph.
 *
 * Drop a file named `hero.jpg` (or .png/.webp/.avif) into `src/assets/` and it
 * becomes the hero automatically. Until then the hero renders its placeholder.
 * Landscape, and at least 2000px wide — it runs full-bleed.
 */
const heroFiles = import.meta.glob<{ default: ImageMetadata }>(
  '/src/assets/hero.{jpg,jpeg,png,webp,avif}',
  { eager: true }
);
export const heroImage: ImageMetadata | undefined = Object.values(heroFiles)[0]?.default;
