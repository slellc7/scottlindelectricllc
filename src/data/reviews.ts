/**
 * Real Google reviews, transcribed word for word from the Google Business
 * Profile. Do not edit the quotes — not for length, not for tone, and not for
 * spelling. Two below contain the reviewer's own typos ("loose power",
 * "with in"); they stay. If a quote must be shortened, cut whole sentences from
 * the end and nothing else.
 *
 * No Review or AggregateRating schema is emitted for these. They are hosted on
 * Google, and marking up third-party reviews as your own is against Google's
 * structured-data guidelines. The star rows are presentational only and reflect
 * the rating each reviewer actually left.
 *
 * `featured` picks the three that appear on the home page.
 */

export type Review = {
  kicker: string;
  quote: string;
  by: string;
  /** Stars the reviewer actually left, out of five. */
  rating: 5 | 4 | 3 | 2 | 1;
  /** Show on the home page. Keep this to three. */
  featured?: boolean;
};

export const allReviews: Review[] = [
  {
    kicker: 'Google review · Dependability',
    quote:
      'Scott and the SLE company did a fantastic job. They worked with us whenever we made errors, and they always found the time to help us. Very dependable, has a great attitude, and very knowledgeable in all areas related to electrical work. Would definitely recommend to anyone needing any scope of electrical work done.',
    by: 'C.J. Fisher',
    rating: 5,
    featured: true,
  },
  {
    kicker: 'Google review · Repeat client',
    quote:
      'Scott has done multiple jobs for me and my clients. He always does great work, shows up on time, and is always available to answer any questions. A valuable asset to our company.',
    by: 'Lauranna Kroll · Basecamp Stays',
    rating: 5,
    featured: true,
  },
  {
    kicker: 'Google review · Workmanship',
    quote:
      "Best electrician in town. Everything Scott performs is to code and clean. Wouldn't hire anyone else!",
    by: 'Sal Paldino · Local Guide',
    rating: 5,
    featured: true,
  },
  {
    kicker: 'Google review · No job too small',
    quote:
      'I had a VERY small job in my kitchen and called Scott. He was prompt with getting back to me, said yes to the job and we scheduled for the next day. Scott contacted me close to my appointment time to let me know he had an emergency in Pocatello and would be later than expected. This worked out just fine for me and I really appreciated him communicating the situation. When he did arrive, the work went very quickly. Scott was professional and friendly and once again apologized for the delay. I really appreciated that he recognized my time and was also willing to take on such a small job. Scott will be my go-to for any future electrical needs and he is the one I will recommend to my friends. Thanks Scott!',
    by: 'Tiffany H · Local Guide',
    rating: 5,
  },
  {
    kicker: 'Google review · Quick scheduling',
    quote:
      'Called Scott with a small job of replacing 4 switches with smart switches. Not only did he say no problem, but he was able to get me on his schedule very quickly, 2 days after I called. Phil and Scott showed up and had the switches replaced and working in no time. I would recommend them without hesitation and will be calling them for any future electrical needs.',
    by: 'Dave Jones',
    rating: 5,
  },
  {
    kicker: 'Google review · After hours',
    quote:
      "We had a GFCI outlet in our basement that was giving us problems and caused us to loose power to our bathroom and hallway. Gave Scott a call after hours in hopes to schedule an appointment for the following day, and he was knocking at our door 20 minutes later. Outstanding customer service from Scott and Charles. They also seemed to be very reasonably priced. I'll never call anyone else for any of my electrical needs.",
    by: 'Wil Lancaster',
    rating: 5,
  },
  {
    kicker: 'Google review · Troubleshooting',
    quote:
      'They showed up to fix a cadet heater that the previous owner of our house had installed and had filled the room with smoke. They both were knowledgeable and quick! They had the cadet heater fixed with in a matter of 30 min. Super professional, I will for sure be calling them for all of our electrical needs.',
    by: 'Brooke Stephens · Local Guide',
    rating: 5,
  },
];

export const homeReviews: Review[] = allReviews.filter((r) => r.featured);
