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
    'Licensed Idaho Falls electrician offering same-day residential, commercial and after-hours electrical service. Free estimates and no service-call fee within 30 miles.',

  phone: '208.716.1240',
  telephoneE164: '+1-208-716-1240',
  telHref: 'tel:+12087161240',

  address: {
    street: '1302 Taylor Avenue',
    city: 'Idaho Falls',
    region: 'ID',
    postalCode: '83404',
    country: 'US',
  },

  areaServed: ['Idaho Falls', 'Ammon', 'Ucon', 'Iona', 'Shelley', 'Rigby', 'Ririe', 'Roberts'],

  services: [
    'Residential electrical repair',
    'Commercial electrical contracting',
    'After-hours emergency electrical service',
    'Parking lot light repair',
    'Security lighting installation and repair',
    'Commercial building electrical maintenance and repair',
    'LED conversion',
  ],

  /**
   * TODO — see README, "Wiring up the estimate form".
   * Until this is a real endpoint, every form slot renders a call-us panel
   * instead. A form posting to a placeholder would 404 and silently eat the
   * customer's message, which on this site is the worst failure available.
   */
  formEndpoint: 'REPLACE_ME',

  /** TODO — paste the "write a review" short link from the Business Profile. */
  reviewUrl: 'https://search.google.com/local/writereview?placeid=REPLACE_ME',
} as const;

export const formEnabled = !SITE.formEndpoint.includes('REPLACE_ME');

export const NAV = [
  { href: '/residential/', label: 'Residential' },
  { href: '/commercial/', label: 'Commercial' },
  { href: '/after-hours/', label: 'After Hours' },
  { href: '/answers/', label: 'Answers' },
  { href: '/ammon/', label: 'Service Area' },
  { href: '/about/', label: 'About' },
  { href: '/reviews/', label: 'Reviews' },
  { href: '/blog/', label: 'Blog' },
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
    { href: '/reviews/', label: 'Reviews' },
    { href: '/answers/', label: 'Answers & FAQ' },
    { href: '/blog/', label: 'Blog' },
    { href: '/contact/', label: 'Contact' },
  ],
} as const;
