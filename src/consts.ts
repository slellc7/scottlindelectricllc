/**
 * Single source of truth for business facts.
 *
 * Anything appearing on more than one page lives here. The NAP (name, address,
 * phone) must match the Google Business Profile character for character —
 * inconsistent NAP is the most common local-SEO own-goal.
 */

export const SITE = {
  url: 'https://scottlindelectric.com',
  name: 'Scott Lind Electric',
  legalName: 'Scott Lind Electric LLC',
  description:
    'Licensed Idaho Falls electrician offering same-day residential, commercial and after-hours electrical service, open 24 hours Monday to Saturday. Free estimates and no service-call fee within 50 miles.',

  slogan: "You've got a friend in the electrical business",

  phone: '208.716.1240',
  telephoneE164: '+1-208-716-1240',
  telHref: 'tel:+12087161240',

  contractorLicense: 'ELE-J-22437',

  /** Twilio Messaging Service number for customer SMS (A2P campaign). */
  smsPhone: '(208) 516-2090',
  smsTelephoneE164: '+12085162090',
  smsHref: 'sms:+12085162090?body=START',

  address: {
    street: '1302 Taylor Avenue',
    city: 'Idaho Falls',
    region: 'ID',
    postalCode: '83404',
    country: 'US',
  },

  areaServed: ['Idaho Falls', 'Ammon', 'Ucon', 'Iona', 'Shelley', 'Rigby', 'Ririe', 'Roberts'],

  /** Geocoded from the shop address. Feeds LocalBusiness.geo — Google uses it
   *  for proximity matching, and it is one of the few properties a small local
   *  site can supply that many competitors don't. */
  geo: { lat: 43.4860098, lng: -112.0198398 },

  /** Verified to resolve to "Scott Lind Electric LLC" on Google Maps. Feeds
   *  both hasMap and sameAs, which is how the site tells Google that this
   *  domain and that Business Profile are the same entity. */
  googleListing: 'https://www.google.com/maps?cid=16827192462932853737',

  social: {
    x: 'https://x.com/scottlindelec',
  },

  /**
   * Business photographs for LocalBusiness.image. Google asks for several
   * high-resolution images at 16:9, 4:3 and 1:1; these are crops of the van
   * shot, each comfortably over the 300,000-pixel floor. Served from public/ so
   * the URLs stay stable — Astro's processed assets are content-hashed and
   * would change filename on every re-encode.
   */
  photos: [
    '/images/scott-lind-electric-van-16x9.jpg',
    '/images/scott-lind-electric-van-4x3.jpg',
    '/images/scott-lind-electric-van-1x1.jpg',
  ],

  /**
   * Hours as set on the Google Business Profile: open 24 hours Monday to
   * Saturday, closed Sunday. These must stay identical to the Business Profile
   * — conflicting hours between a site and a GBP listing is a trust signal
   * Google actively weighs.
   */
  hours: {
    open24: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
    closed: ['Sunday'],
  },

  services: [
    'Residential electrical repair',
    'Commercial electrical contracting',
    'After-hours emergency electrical service',
    'Parking lot light repair',
    'Security lighting installation and repair',
    'Illuminated sign and channel letter repair',
    'Canopy and forecourt lighting',
    'Commercial building electrical maintenance and repair',
    'LED conversion',
  ],

  /**
   * Netlify Forms. The form submits (via fetch, url-encoded) to this static
   * detection file — public/__forms.html, which Astro copies verbatim into
   * dist/ — where Netlify's deploy-time crawler registers the "estimate" form
   * and the union of every field either variant sends. Moving this off the
   * 'REPLACE_ME' placeholder also flips `formEnabled` true so the real form
   * renders instead of the call-us panel. Capture only works on the deployed
   * Netlify site, never under `astro dev`. See README, "Wiring up the estimate form".
   */
  formEndpoint: '/__forms.html',

  /**
   * Google listing, via the CID from the Business Profile's feature id
   * (0x53545fd1c00db917:0xe9863264083e43e9). Verified to open
   * "Scott Lind Electric LLC" — the Reviews tab there has the write button.
   *
   * For a true one-click review form, Scott can copy the short link from his
   * Business Profile ("Ask for reviews"); it looks like
   * https://g.page/r/XXXXXXXX/review and can replace this directly.
   */
  reviewUrl: 'https://www.google.com/maps?cid=16827192462932853737',
} as const;

export const formEnabled = !SITE.formEndpoint.includes('REPLACE_ME');

export const NAV = [
  { href: '/residential/', label: 'Residential' },
  { href: '/commercial/', label: 'Commercial' },
  { href: '/after-hours/', label: 'After Hours' },
  { href: '/answers/', label: 'Answers' },
  { href: '/service-area/', label: 'Service Area' },
  { href: '/about/', label: 'About' },
  { href: '/reviews/', label: 'Reviews' },
  { href: '/blog/', label: 'Blog' },
  { href: '/contact/', label: 'Contact' },
] as const;

export const FOOTER = {
  services: [
    { href: '/residential/', label: 'Residential electrical' },
    { href: '/commercial/', label: 'Commercial electrical' },
    { href: '/after-hours/', label: 'After-hours emergency' },
    { href: '/work/', label: 'Recent work' },
    { href: '/contact/', label: 'Free estimates' },
  ],
  company: [
    { href: '/about/', label: 'About Scott' },
    { href: '/service-area/', label: 'Service area' },
    { href: '/service-area/idaho-falls/', label: 'Electrician in Idaho Falls' },
    { href: '/service-area/ammon/', label: 'Electrician in Ammon' },
    { href: '/reviews/', label: 'Reviews' },
    { href: '/answers/', label: 'Answers & FAQ' },
    { href: '/blog/', label: 'Blog' },
    { href: '/contact/', label: 'Contact' },
    { href: '/privacy/', label: 'Privacy Policy' },
    { href: '/terms/', label: 'Terms & Conditions' },
    { href: '/sms/', label: 'SMS updates' },
  ],
} as const;
