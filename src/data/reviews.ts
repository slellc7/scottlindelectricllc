/**
 * PLACEHOLDERS — every entry below is a slot, not a review.
 *
 * Replace each `quote` and `by` with a real, attributed review pasted word for
 * word from the Google Business Profile. Do not write review text: invented
 * reviews are an FTC matter, not merely an SEO one. Delete any slot you can't
 * fill rather than leaving the placeholder text live.
 */

export type Review = { kicker: string; quote: string; by: string };

export const homeReviews: Review[] = [
  {
    kicker: 'Google review 01',
    quote:
      'Paste a real Google review here — two or three sentences, exactly as the customer wrote it.',
    by: 'Customer name · Idaho Falls',
  },
  {
    kicker: 'Google review 02',
    quote:
      'Paste a real Google review here — ideally one that mentions the specific job and the response time.',
    by: 'Customer name · Ammon',
  },
  {
    kicker: 'Google review 03',
    quote: 'Paste a real Google review here — a commercial customer, if you have one.',
    by: 'Business name · Idaho Falls',
  },
];

export const allReviews: Review[] = [
  {
    kicker: 'Google review 01 · Residential',
    quote: 'Paste the review text here, word for word from Google.',
    by: 'Customer name · Idaho Falls',
  },
  {
    kicker: 'Google review 02 · Same-day',
    quote: 'Paste a review that mentions how fast we got there.',
    by: 'Customer name · Ammon',
  },
  {
    kicker: 'Google review 03 · Commercial',
    quote: 'Paste a review from a business customer.',
    by: 'Business name · Idaho Falls',
  },
  {
    kicker: 'Google review 04 · Small job',
    quote: "Paste a review about a job other electricians wouldn't take.",
    by: 'Customer name · Idaho Falls',
  },
  {
    kicker: 'Google review 05 · After hours',
    quote: 'Paste a review from an after-hours call.',
    by: 'Customer name · Ucon',
  },
];
