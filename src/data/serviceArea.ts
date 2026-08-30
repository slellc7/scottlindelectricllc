/**
 * Towns Scott Lind Electric covers.
 *
 * Order is deliberate: Idaho Falls first because that is where the shop is,
 * then Ammon, then the rest of the radius.
 *
 * `href` points at the town's own page under /service-area/. Idaho Falls and
 * Ammon have one each; towns without a page are listed unlinked. They are still
 * covered, and saying so plainly beats inventing a thin page for each.
 *
 * The Idaho Falls page is written to sit *beside* the home page rather than
 * repeat it — local utility split, local housing stock, local response — so the
 * two are not competing for the same query with the same content.
 *
 * `note` must stay factual. Only fill it where the fact is actually known —
 * a wrong drive time on a real business's site is worse than no drive time.
 */

export type Town = {
  name: string;
  href?: string;
  /** true = home ground, styled as primary */
  primary?: boolean;
  note?: string;
};

export const towns: Town[] = [
  {
    name: 'Idaho Falls',
    href: '/service-area/idaho-falls/',
    primary: true,
    note: 'Home ground — the shop is on Taylor Avenue, so most of our work starts and ends here.',
  },
  {
    name: 'Ammon',
    href: '/service-area/ammon/',
    primary: true,
    note: 'Under ten minutes from the shop. Same-day repair is normal for Ammon calls.',
  },
  // TODO — Scott: a line each on what you actually do in these towns turns them
  // into pages worth having. Without genuinely different local copy they would
  // be near-duplicates, which Google discounts, so they stay as entries for now.
  { name: 'Ucon' },
  { name: 'Iona' },
  { name: 'Shelley' },
  { name: 'Firth' },
  { name: 'Basalt' },
  { name: 'Blackfoot' },
  { name: 'Fort Hall' },
  { name: 'Pocatello' },
  { name: 'Rigby' },
  { name: 'Menan' },
  { name: 'Lewisville' },
  { name: 'Ririe' },
  { name: 'Roberts' },
  { name: 'Swan Valley' },
  { name: 'Irwin' },
  { name: 'Rexburg' },
  { name: 'Sugar City' },
  { name: 'St. Anthony' },
  { name: 'Ashton' },
  { name: 'Hamer' },
  { name: 'Mud Lake' },
  { name: 'Terreton' },
  { name: 'Driggs' },
  { name: 'Victor' },
];
