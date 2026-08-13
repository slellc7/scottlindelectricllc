/**
 * Job-photo gallery.
 *
 * HOW TO ADD PHOTOS: drop image files into `src/assets/photos/`. They are
 * picked up automatically, optimized to WebP with srcset, and appear on /work/
 * and in the home-page strip. Then describe them here, keyed by filename
 * without its extension.
 *
 * `alt` describes the picture for someone who cannot see it — what is actually
 * in frame. `caption` is the visible line under it — what the job was. They are
 * different jobs and should not be the same sentence.
 *
 * A NOTE ON CLIENT BRANDS: several photos show identifiable businesses
 * (a fuel brand, a car dealership). The alt text describes what is visible,
 * which is accurate and fair, but the captions deliberately do not claim those
 * companies as clients or imply endorsement. Worth confirming with Scott that
 * each of them is happy to appear before this goes live.
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
  '01-restaurant-digital-menu-boards': {
    alt: 'Illuminated digital menu boards mounted above a fast-food service counter, kitchen visible behind',
    caption: 'Digital menu board install, quick-service restaurant',
    category: 'Commercial',
  },
  '02-restaurant-menu-board-lighting': {
    alt: 'Backlit menu boards and ceiling track lighting above a restaurant service line',
    caption: 'Menu board and track lighting, restaurant fit-out',
    category: 'Commercial',
  },
  '03-drive-thru-menu-board-install': {
    alt: 'Outdoor drive-thru digital menu screens on a pole beside a red brick restaurant wall, mid-installation',
    caption: 'Drive-thru menu board, power run and set',
    category: 'Commercial',
  },
  '04-drive-thru-digital-menu-boards': {
    alt: 'Completed drive-thru digital menu boards lit and running alongside a restaurant lane',
    caption: 'Drive-thru boards, finished and live',
    category: 'Commercial',
  },
  '05-commercial-disconnect-switches': {
    alt: 'Bank of grey safety disconnect switches on a unistrut rack beside a red fire alarm panel',
    caption: 'Equipment disconnects and service work',
    category: 'Industrial',
  },
  '06-drive-thru-winter-service-call': {
    alt: 'Exterior of a drive-thru restaurant with snow on the ground, seen from the service van',
    caption: 'Winter service call, Idaho Falls',
    category: 'Commercial',
  },
  '07-dealership-pylon-sign-lighting': {
    alt: 'Tall illuminated dealership pylon sign lit against a deep blue dusk sky',
    caption: 'Pylon sign lighting, dealership',
    category: 'Commercial',
    feature: true,
  },
  '08-commercial-new-construction': {
    alt: 'Interior of a commercial building under construction, exposed steel beams and a scissor lift',
    caption: 'Ground-up commercial, rough-in stage',
    category: 'Commercial',
  },
  '09-channel-letter-sign-repair': {
    alt: 'Close-up of a channel-letter sign opened up, internal LED modules and wiring exposed for repair',
    caption: 'Channel-letter sign repair',
    category: 'Commercial',
  },
  '10-fuel-station-canopy-lighting': {
    alt: 'Fuel station canopy and illuminated sign photographed from below against a cloudy sky',
    caption: 'Canopy and sign lighting, fuel station',
    category: 'Commercial',
  },
  '11-fuel-station-canopy-lot-lighting': {
    alt: 'Fuel station forecourt with canopy lighting and a lift positioned for work',
    caption: 'Forecourt lighting service',
    category: 'Commercial',
  },
  '12-crystal-chandelier-install': {
    alt: 'Large crystal chandelier lit, hanging close to a pale wall',
    caption: 'Crystal chandelier install',
    category: 'Residential',
  },
  '13-entryway-chandelier-two-storey': {
    alt: 'Crystal chandelier hanging in a two-storey entryway above an arched window and front door',
    caption: 'Two-storey entryway chandelier',
    category: 'Residential',
    feature: true,
  },
  '14-commercial-electrical-room-panels': {
    alt: 'Electrical room wall with several panels, meter sockets and conduit runs feeding them',
    caption: 'Panel and conduit work, electrical room',
    category: 'Commercial',
  },
};

/** Fallback when a file has no entry above. Honest, if unspecific. */
export const genericAlt = 'Electrical work by Scott Lind Electric in Idaho Falls, Idaho';

/** "panel-swap-ammon.jpg" -> "Panel swap ammon" */
export function titleFromFilename(name: string): string {
  const words = name.replace(/[-_]+/g, ' ').replace(/\s+/g, ' ').trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
