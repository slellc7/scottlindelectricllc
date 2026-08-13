/**
 * FAQ content.
 *
 * These arrays are the single source for both the rendered Q&A blocks and the
 * FAQPage structured data — <FaqGrid> renders them, <Base faqs={...}> emits the
 * schema from the same array. Write a question once; the schema follows it.
 *
 * (The old build scraped questions back out of rendered HTML with a regex. This
 * is the same idea done properly.)
 */

export type Faq = { q: string; a: string };

export const homeFaqs: Faq[] = [
  {
    q: 'Do you charge a service-call fee?',
    a: 'No. There is no service-call fee for any customer within a 30-mile radius of Idaho Falls, which includes Ammon, Ucon, Iona and Shelley. You pay for the work performed.',
  },
  {
    q: 'Can an electrician come out today?',
    a: 'Usually, yes. Same-day service is standard for repair calls in Idaho Falls and Ammon — call in the morning and we will tell you honestly whether today is realistic.',
  },
  {
    q: 'Is my job too small to bother you with?',
    a: 'No. One dead outlet is a legitimate call. Small jobs are how we earn the big ones, so they get a real appointment and a real technician.',
  },
  {
    q: 'Are you licensed and insured?',
    a: 'Yes — Scott Lind Electric LLC is a state-licensed and insured Idaho electrical contractor. Ask for the license number and we will hand it to you.',
  },
];

export const residentialFaqs: Faq[] = [
  {
    q: 'Will you come out for one outlet?',
    a: 'Yes. One outlet is a normal call, and inside 30 miles of Idaho Falls there is no service-call fee for making the trip.',
  },
  {
    q: 'Do I need to be home?',
    a: "For most repairs, yes — someone needs to let us in and confirm what the problem looks like when it happens. Tell us on the phone and we'll work around your schedule.",
  },
  {
    q: 'Do you pull permits?',
    a: 'When the work requires a permit and inspection, we handle it. We will tell you up front whether your job needs one.',
  },
  {
    q: 'How fast can you get here?',
    a: 'Same-day is typical for repair calls in Idaho Falls and Ammon. If today is not realistic we will say so on the phone rather than leave you waiting.',
  },
];

export const commercialFaqs: Faq[] = [
  {
    q: 'How big a project can you take?',
    a: "Commercial projects of any size or type, from a single circuit to a building wired from the ground up. If a job is genuinely outside what we should take on, we'll say so.",
  },
  {
    q: 'Can you work outside business hours?',
    a: 'Yes. We are open 24 hours Monday to Saturday, so shutdowns, lot lighting and anything that would interrupt trading can be scheduled after close or before opening. We are closed Sunday.',
  },
  {
    q: 'Are estimates really free?',
    a: 'Yes — we walk the job, scope it and price it before any commitment, at no charge.',
  },
  {
    q: 'Do you work with general contractors?',
    a: 'Regularly. We coordinate with other trades and hold our part of the schedule — the reason GCs call us back.',
  },
];

export const emergencyFaqs: Faq[] = [
  {
    q: 'Do you answer the phone at night?',
    a: "Yes — we are open 24 hours a day, Monday to Saturday, and we will tell you honestly whether we can be there tonight or first thing in the morning. If it's dangerous, we treat it as dangerous. We are closed Sunday.",
  },
  {
    q: 'Are you open on Sunday?',
    a: 'No. We are open around the clock Monday to Saturday and closed on Sunday. If something is smoking, sparking or wet on a Sunday, treat it as an emergency: shut off the breaker feeding it if you can do so safely, call 911 if there is fire or smoke in a wall, and call us first thing Monday.',
  },
  {
    q: 'What counts as an electrical emergency?',
    a: 'Anything hot, smoking, sparking or wet, a breaker that will not hold, a total loss of power to the building, or a fault that stops a business trading. The table above covers the common cases.',
  },
  {
    q: 'Which areas do you cover after hours?',
    a: 'Idaho Falls, Ammon and the surrounding communities within 30 miles — Ucon, Iona, Shelley, Rigby, Ririe and Roberts included — 24 hours a day, Monday to Saturday.',
  },
  {
    q: 'Should I shut off the main breaker?',
    a: 'If you can reach it safely and dryly and something is smoking, sparking or wet — yes, then call. If reaching it means standing in water or touching a hot panel, stay back and call from a safe distance.',
  },
];

export const ammonFaqs: Faq[] = [
  {
    q: 'Do you charge extra to come to Ammon?',
    a: 'No. Ammon is well inside the 30-mile radius, so there is no service-call fee — you pay for the work, not the drive.',
  },
  {
    q: 'How quickly can you get to Ammon?',
    a: 'Our shop is on Taylor Avenue in Idaho Falls, under ten minutes out. Same-day service is normal for Ammon repair calls.',
  },
];

/* ── Answers page: four numbered sections ────────────────────────────────── */

export const answersHiring: Faq[] = [
  {
    q: 'Do you charge a service-call fee?',
    a: 'No — there is no service-call fee for any customer within 30 miles of Idaho Falls. That covers Ammon, Ucon, Iona, Shelley, Rigby, Ririe and Roberts. You pay for the work performed, not for us to show up.',
  },
  {
    q: 'Are estimates free?',
    a: "Yes. We look at the job, scope it and give you a price before any work starts, at no charge. For larger projects we'll walk the plans with you or your contractor.",
  },
  {
    q: 'Can an electrician come out today?',
    a: "Usually. Same-day service is standard for repair calls in Idaho Falls and Ammon. Call in the morning for the best chance of a same-day slot — and if today isn't realistic, we'll tell you that instead of leaving you waiting.",
  },
  {
    q: 'Is my job too small?',
    a: 'No. One dead outlet, one bad switch, one fixture — those are real calls and they get a real appointment. Small jobs are how we earn the trust that brings us the big ones.',
  },
  {
    q: 'Are you licensed and insured?',
    a: "Yes — Scott Lind Electric LLC is a state-licensed, insured Idaho electrical contractor. Ask for the license number and we'll give it to you before we start.",
  },
  {
    q: 'What areas do you serve?',
    a: 'Idaho Falls, Ammon and everywhere within roughly 30 miles across Bonneville and Jefferson counties. Further out is still possible — call and ask.',
  },
];

export const answersProblems: Faq[] = [
  {
    q: 'Why does my breaker keep tripping?',
    a: 'A breaker trips because it is doing its job. The three usual causes are an overloaded circuit (too much running at once), a short or ground fault in the wiring or a device, or a breaker that has simply worn out. If it resets and holds, note what was running when it tripped. If it trips instantly with nothing plugged in, leave it off and call — that is a fault, not an overload.',
  },
  {
    q: 'Half my outlets died at once. Why?',
    a: "Most often a tripped GFCI upstream on the same circuit — check bathrooms, the kitchen, the garage and outside for a receptacle with a reset button. Press it. If nothing comes back, or there's no GFCI to find, a connection has failed somewhere in the run and it needs tracing.",
  },
  {
    q: 'My lights flicker or dim when appliances start. Serious?',
    a: 'A brief dim when a big motor starts is normal. Flickering that comes and goes on its own, or gets worse over time, is not — it often means a loose connection, and loose connections make heat. Get it looked at rather than waiting.',
  },
  {
    q: 'Should I upgrade my electrical panel?',
    a: "Consider it if the panel is full with no room for the circuits you need, if it's an obsolete or known-problem brand, if there's rust or scorching inside, or if you're adding significant load like a shop, hot tub or AC. A panel that is simply old and healthy can stay.",
  },
  {
    q: 'Why are my parking lot lights out again?',
    a: 'Repeated pole-light failures usually trace to water in a base or junction, a failing photocell or contactor, or a feed that has been damaged underground — not the lamp. Replacing lamps over and over treats the symptom. Converting to LED at the same time cuts the maintenance cycle down hard.',
  },
  {
    q: 'Is LED conversion worth it for a business?',
    a: 'For most commercial spaces, yes — lower draw, far longer life, better light, and no ballasts to chase. The case is strongest for high-bay warehouse fixtures, lots and any space that runs lights all day.',
  },
];

export const answersSafety: Faq[] = [
  {
    q: 'Do I need a permit for electrical work in Idaho?',
    a: "New circuits, panel work, service changes and most remodel wiring require a permit and inspection; a like-for-like device swap generally does not. When your job needs one, we handle the permit and the inspection — and we'll tell you up front which category you're in.",
  },
  {
    q: 'What should I do before you arrive?',
    a: "Clear access to the panel and to whatever isn't working, and note the pattern — what fails, when, and what else is running. That detail routinely saves an hour of diagnosis, which saves you money.",
  },
  {
    q: 'When is an electrical problem an emergency?',
    a: "When something is hot, smoking, sparking or wet; when a breaker won't hold; when the whole building has lost power but the neighbours haven't; or when a fault stops a business trading. Anything else can usually wait for a same-day appointment.",
  },
  {
    q: 'Can I do my own electrical work?',
    a: "Some homeowner work is legal in Idaho on your own residence, but permits, inspections and code compliance still apply — and insurers ask questions after a fire. Anything inside the panel, anything on the service, and anything you're unsure about should go to a licensed electrician.",
  },
];

export const allAnswersFaqs: Faq[] = [...answersHiring, ...answersProblems, ...answersSafety];
