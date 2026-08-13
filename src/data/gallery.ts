/**
 * Job-photo gallery.
 *
 * HOW TO ADD PHOTOS: drop image files into `src/assets/photos/`. That's it —
 * they are picked up automatically, optimized to WebP with srcset, and appear
 * on /work/ and in the home-page strip. No code change required.
 *
 * Then come back and describe them here. The key is the filename (without
 * extension); everything is optional. A photo with no entry still renders, but
 * with generic alt text — which is a real accessibility and SEO cost, so the
 * build prints a warning listing anything undescribed.
 *
 * `alt` describes the picture for someone who cannot see it (what is in frame).
 * `caption` is the visible line under it (what the job was). They are different
 * jobs and should not be the same sentence.
 */

export type PhotoMeta = {
  alt?: string;
  caption?: string;
  /** Shown as the small kicker. Keep to the service categories the site uses. */
  category?: 'Residential' | 'Commercial' | 'After hours' | 'Industrial' | 'The crew';
  /** Give the best shots the wide slot in the grid. */
  feature?: boolean;
};

export const photoMeta: Record<string, PhotoMeta> = {
  // Example — one entry per file in src/assets/photos/, keyed by filename
  // without its extension:
  //
  // 'service-van': {
  //   alt: 'Scott Lind Electric service van parked on a rural road outside Idaho Falls',
  //   caption: 'Service van, Idaho Falls',
  //   category: 'Residential',
  //   feature: true,
  // },
};

/** Fallback when a file has no entry above. Honest, if unspecific. */
export const genericAlt = 'Electrical work by Scott Lind Electric in Idaho Falls, Idaho';

/** "panel-swap-ammon.jpg" -> "Panel swap ammon" */
export function titleFromFilename(name: string): string {
  const words = name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
