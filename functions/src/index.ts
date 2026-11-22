import { createHash, createHmac, randomInt, randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import OpenAI from 'openai';

initializeApp();
const db = getFirestore();

const openaiApiKey = defineSecret('OPENAI_API_KEY');
const resendApiKey = defineSecret('RESEND_API_KEY');
const twilioAccountSid = defineSecret('TWILIO_ACCOUNT_SID');
const twilioAuthToken = defineSecret('TWILIO_AUTH_TOKEN');
const xApiKey = defineSecret('X_API_KEY');
const xApiSecret = defineSecret('X_API_SECRET');
const xAccessToken = defineSecret('X_ACCESS_TOKEN');
const xAccessTokenSecret = defineSecret('X_ACCESS_TOKEN_SECRET');
const githubToken = defineSecret('GITHUB_TOKEN');

const openaiModel = defineString('OPENAI_MODEL', { default: 'gpt-5.6' });
const allowedOrigins = defineString('ALLOWED_ORIGINS', {
  default: 'http://localhost:4321,http://localhost:8888,https://scottlindelectric.com,https://www.scottlindelectric.com',
});
const resendFromEmail = defineString('RESEND_FROM_EMAIL');
const businessEmailTo = defineString('BUSINESS_EMAIL_TO');
const twilioFromNumber = defineString('TWILIO_FROM_NUMBER');
const businessSmsTo = defineString('BUSINESS_SMS_TO');
const githubOwner = defineString('GITHUB_OWNER', { default: 'slellc7' });
const githubRepo = defineString('GITHUB_REPO', { default: 'scottlindelectricllc' });
const githubBranch = defineString('GITHUB_BRANCH', { default: 'main' });

const SOCIAL_CITY_TAGS = [
  { city: 'Idaho Falls', hashtag: '#IdahoFalls' },
  { city: 'Ammon', hashtag: '#AmmonIdaho' },
  { city: 'Ucon', hashtag: '#UconIdaho' },
  { city: 'Iona', hashtag: '#IonaIdaho' },
  { city: 'Shelley', hashtag: '#ShelleyIdaho' },
  { city: 'Firth', hashtag: '#FirthIdaho' },
  { city: 'Basalt', hashtag: '#BasaltIdaho' },
  { city: 'Blackfoot', hashtag: '#BlackfootIdaho' },
  { city: 'Fort Hall', hashtag: '#FortHallIdaho' },
  { city: 'Pocatello', hashtag: '#PocatelloIdaho' },
  { city: 'Rigby', hashtag: '#RigbyIdaho' },
  { city: 'Menan', hashtag: '#MenanIdaho' },
  { city: 'Lewisville', hashtag: '#LewisvilleIdaho' },
  { city: 'Ririe', hashtag: '#RirieIdaho' },
  { city: 'Roberts', hashtag: '#RobertsIdaho' },
  { city: 'Swan Valley', hashtag: '#SwanValleyIdaho' },
  { city: 'Irwin', hashtag: '#IrwinIdaho' },
  { city: 'Rexburg', hashtag: '#RexburgIdaho' },
  { city: 'Sugar City', hashtag: '#SugarCityIdaho' },
  { city: 'St. Anthony', hashtag: '#StAnthonyIdaho' },
  { city: 'Ashton', hashtag: '#AshtonIdaho' },
  { city: 'Hamer', hashtag: '#HamerIdaho' },
  { city: 'Mud Lake', hashtag: '#MudLakeIdaho' },
  { city: 'Terreton', hashtag: '#TerretonIdaho' },
  { city: 'Driggs', hashtag: '#DriggsIdaho' },
  { city: 'Victor', hashtag: '#VictorIdaho' },
] as const;

const SOCIAL_POST_PROMPT = `You write social posts for Scott Lind Electric LLC, a licensed electrician in Idaho Falls, Idaho.

Create one original X post. Alternate naturally between helpful electrical education and promotion of the business. Use only these verified facts:
- Residential and commercial electrical service
- After-hours service Monday through Saturday
- Idaho Falls, Ammon, and nearby eastern Idaho communities
- Free estimates and no service-call fee within 50 miles
- Phone: 208-716-1240
- Website: https://scottlindelectric.com
- Services include troubleshooting, panels, lighting, remodels, parking-lot and security lighting, illuminated signs, building maintenance, and LED conversions

Requirements:
- Maximum 210 characters, including links; the system adds hashtags afterward
- Friendly, capable, plainspoken tone
- No emoji and no hashtags in the generated text
- No fabricated projects, testimonials, discounts, guarantees, or availability claims
- Do not give risky do-it-yourself electrical instructions
- Do not use trending-topic bait, mentions, replies, or substantially repeat a recent post
- Include a natural call to action only when it fits`;

const socialPostSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['text', 'theme'],
  properties: {
    text: { type: 'string', maxLength: 210 },
    theme: { type: 'string', enum: ['education', 'promotion'] },
  },
} as const;

const BLOG_CATEGORIES = [
  'residential troubleshooting',
  'electrical safety',
  'seasonal needs',
  'commercial maintenance',
  'lighting',
  'panels and service',
  'remodels and additions',
] as const;

const BLOG_POST_PROMPT = `You write practical, safety-first SEO articles for Scott Lind Electric LLC.

Choose one useful topic with clear search intent for a homeowner or business in southeastern Idaho. Avoid duplicating the existing posts supplied in the request. Rotate naturally among the allowed categories and prefer a specific question or maintenance need over a broad survey article.

Use only business facts found in the supplied repository excerpts. Never invent a project, customer story, review, credential, price, warranty, availability claim, statistic, code requirement, utility fact, or local fact. Do not imply that generated copy is based on an inspection or completed job.

Requirements:
- 900 to 1,400 words in body
- title no longer than 70 characters
- description between 80 and 165 characters
- a lowercase hyphenated slug that does not contain a date
- 3 to 5 concise tags
- a concise introduction followed by at least four descriptive H2 sections
- actionable observations and preparation steps that do not involve opening electrical equipment, touching wiring, testing live parts, or performing hazardous electrical work
- tell readers to stop and seek professional or emergency help when heat, smoke, fire, sparking, shock, water, or damaged energized equipment is involved
- natural southeastern Idaho context only where it helps the reader; do not keyword-stuff or create city-by-city doorway copy
- at least two natural internal Markdown links chosen from the allowed links in the request
- a restrained final call to action

Return the article body as Markdown without frontmatter, an H1, HTML, code fences, or external links. Do not mention SEO, keywords, AI, the prompt, or the source excerpts.`;

const blogPostSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['title', 'description', 'slug', 'category', 'searchIntent', 'tags', 'body'],
  properties: {
    title: { type: 'string', minLength: 10, maxLength: 70 },
    description: { type: 'string', minLength: 80, maxLength: 165 },
    slug: { type: 'string', minLength: 10, maxLength: 80, pattern: '^[a-z0-9]+(?:-[a-z0-9]+)*$' },
    category: { type: 'string', enum: BLOG_CATEGORIES },
    searchIntent: { type: 'string', minLength: 20, maxLength: 180 },
    tags: {
      type: 'array', minItems: 3, maxItems: 5,
      items: { type: 'string', minLength: 2, maxLength: 40 },
    },
    body: { type: 'string', minLength: 4000, maxLength: 14000 },
  },
} as const;

type GeneratedBlogPost = {
  title: string;
  description: string;
  slug: string;
  category: typeof BLOG_CATEGORIES[number];
  searchIntent: string;
  tags: string[];
  body: string;
};

type Lead = {
  name: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  addressConfirmed: boolean;
  issue: string | null;
  serviceType: 'residential' | 'commercial' | 'urgent' | null;
};

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type RequestedField = 'name' | 'phone' | 'email' | 'address';

const EMPTY_LEAD: Lead = {
  name: null, phone: null, email: null, address: null,
  city: null, state: null, addressConfirmed: false, issue: null, serviceType: null,
};

const SYSTEM_PROMPT = `You are the website lead coordinator for Scott Lind Electric LLC in Idaho Falls, Idaho.

Briefly and warmly collect a potential customer's name, phone, optional email, service address, and electrical problem. Residential or commercial is already collected before this conversation. Ask one clear question at a time and let the visitor type every answer. Never promise an arrival time, price, diagnosis, or code compliance. Never ask a visitor to open a panel, touch wiring, test live equipment, or take any electrical risk.

Ask for details conversationally in this order when they are missing: electrical problem, name, phone, optional email, then full service address including city, state, and ZIP. Tell the visitor they may type "skip" when asked for optional email. Extract typed details into lead. Use an empty requestedFields array; the website no longer shows contact-detail forms.

When extracting an address, keep the street address in address, city in city, and two-letter state abbreviation in state when known. Never set addressConfirmed true yourself; the server confirms the address with the visitor. Scott Lind Electric only accepts requests in Idaho. Do not mark a lead ready until addressConfirmed is true.

If there is smoke, fire, flames, a burning smell, active sparking, a hot or buzzing panel, electrical shock, or a downed power line, tell the visitor to move away, call 911 for fire, injury, or immediate danger, call their utility for a downed line, and call Scott Lind Electric at 208-716-1240 only once safe. Mark emergency true.

Email is optional. A lead is ready when name, phone, issue, service address, and address confirmation are present. When ready, say you have the essentials and ask them to review and send their information to Scott Lind Electric using the button below. Keep replies under 70 words.`;

const intakeSchema = {
  type: 'object', additionalProperties: false,
  required: ['reply', 'ready', 'emergency', 'requestedFields', 'lead'],
  properties: {
    reply: { type: 'string' }, ready: { type: 'boolean' }, emergency: { type: 'boolean' },
    requestedFields: {
      type: 'array', maxItems: 2,
      items: { type: 'string', enum: ['name', 'phone', 'email', 'address'] },
    },
    lead: {
      type: 'object', additionalProperties: false,
      required: ['name', 'phone', 'email', 'address', 'city', 'state', 'addressConfirmed', 'issue', 'serviceType'],
      properties: {
        name: { type: ['string', 'null'] }, phone: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] }, address: { type: ['string', 'null'] },
        city: { type: ['string', 'null'] }, state: { type: ['string', 'null'] },
        addressConfirmed: { type: 'boolean' }, issue: { type: ['string', 'null'] },
        serviceType: { type: ['string', 'null'], enum: ['residential', 'commercial', 'urgent', null] },
      },
    },
  },
} as const;

function clean(value: unknown, max = 300) {
  return typeof value === 'string' ? value.trim().slice(0, max) || null : null;
}

function cleanLead(value: unknown): Lead {
  const lead = value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  const serviceType = ['residential', 'commercial', 'urgent'].includes(String(lead.serviceType))
    ? (lead.serviceType as Lead['serviceType']) : null;
  return {
    name: clean(lead.name, 100), phone: clean(lead.phone, 40), email: clean(lead.email, 200),
    address: clean(lead.address, 200), city: clean(lead.city, 100), state: clean(lead.state, 20),
    addressConfirmed: lead.addressConfirmed === true, issue: clean(lead.issue, 1000),
    serviceType,
  };
}

function cleanMessages(value: unknown): ChatMessage[] {
  if (!Array.isArray(value)) return [];
  return value.slice(-16).flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const role = (item as Record<string, unknown>).role;
    const content = clean((item as Record<string, unknown>).content, 1500);
    return (role === 'user' || role === 'assistant') && content ? [{ role, content }] : [];
  });
}

function isDangerous(text: string) {
  return /\b(smoke|flames?|on fire|burning smell|sparking|hot panel|buzzing panel|electrocut|electric shock|downed (power )?lines?)\b/i.test(text);
}

function leadText(lead: Lead) {
  return [`Name: ${lead.name ?? 'Not provided'}`, `Phone: ${lead.phone ?? 'Not provided'}`,
    `Email: ${lead.email ?? 'Not provided'}`, `Address: ${lead.address ?? 'Not provided'}`,
    `City: ${lead.city ?? 'Not provided'}`, `State: ${lead.state ?? 'Not provided'}`,
    `Address confirmed: ${lead.addressConfirmed ? 'Yes' : 'No'}`, `Type: ${lead.serviceType ?? 'Not specified'}`,
    `Problem: ${lead.issue ?? 'Not provided'}`].join('\n');
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[char]!);
}

function normalizeUsPhone(value: string) {
  const digits = value.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

function setCors(origin: string | undefined, response: { set: (field: string, value: string) => unknown }) {
  const allowed = allowedOrigins.value().split(',').map((value) => value.trim());
  if (origin && allowed.includes(origin)) {
    response.set('Access-Control-Allow-Origin', origin);
    response.set('Vary', 'Origin');
  }
  response.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  response.set('Access-Control-Allow-Headers', 'Content-Type');
  return !origin || allowed.includes(origin);
}

async function sendEmail(to: string, subject: string, text: string) {
  const providerResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${resendApiKey.value()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: resendFromEmail.value(), to: [to], subject, text,
      html: `<pre style="font:16px/1.5 sans-serif;white-space:pre-wrap">${escapeHtml(text)}</pre>` }),
  });
  if (!providerResponse.ok) throw new Error(`Email provider returned ${providerResponse.status}`);
}

async function sendSms(to: string, body: string) {
  const sid = twilioAccountSid.value();
  const providerResponse = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${twilioAuthToken.value()}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ To: to, From: twilioFromNumber.value(), Body: body }),
  });
  if (!providerResponse.ok) throw new Error(`SMS provider returned ${providerResponse.status}`);
}

async function storeAndNotify(
  lead: Lead,
  source: unknown,
  requestId: unknown,
  consent: unknown,
  options: { smsConsent?: boolean; preferredContact?: string; serviceCategory?: string } = {},
) {
  if (!lead.name || !lead.phone || !lead.issue || !lead.address) {
    return { status: 400, body: { error: 'Name, phone, problem, and service address are required.' } };
  }
  if (!lead.addressConfirmed || !['ID', 'IDAHO'].includes((lead.state ?? '').toUpperCase())) {
    return { status: 400, body: { error: 'A confirmed Idaho service address is required.' } };
  }
  if (consent !== true) {
    return { status: 400, body: { error: 'Consent is required before sending this request.' } };
  }
  const smsConsent = options.smsConsent ?? true;
  const customerPhone = normalizeUsPhone(lead.phone);
  if (!customerPhone) {
    return { status: 400, body: { error: 'Enter a valid 10-digit U.S. mobile phone number.' } };
  }
  const id = typeof requestId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(requestId) ? requestId : randomUUID();
  const leadRef = db.collection('leads').doc(id);
  await leadRef.set({ ...lead, source: clean(source, 300) ?? 'AI website assistant', consent: true,
    preferredContact: clean(options.preferredContact, 20), serviceCategory: clean(options.serviceCategory, 40),
    consentChannels: { phone: true, sms: smsConsent, email: Boolean(lead.email) },
    status: 'new', createdAt: FieldValue.serverTimestamp(), notifications: {
      sms: 'pending', email: 'pending', customerSms: smsConsent ? 'pending' : 'skipped', customerEmail: lead.email ? 'pending' : 'skipped',
    } });

  const details = [leadText(lead), `Requested service: ${options.serviceCategory ?? 'Not specified'}`, `Preferred contact: ${options.preferredContact ?? 'Not specified'}`, `Customer SMS consent: ${smsConsent ? 'Yes' : 'No'}`].join('\n');
  const customerSms = smsConsent
    ? sendSms(customerPhone, 'Scott Lind Electric: We received your electrical service request. Scott will contact you directly. This is not an appointment confirmation. Reply STOP to opt out or HELP for help. Call 208-716-1240.')
    : Promise.resolve();
  const customerEmail = lead.email
    ? sendEmail(
      lead.email,
      'We received your request — Scott Lind Electric',
      `Hi ${lead.name},\n\nWe received your electrical service request. Scott will review it and contact you directly. This message confirms receipt only; it does not confirm an appointment.\n\nIf the situation becomes urgent, call 208-716-1240. For fire, smoke, shock, or immediate danger, move away and call 911.\n\nScott Lind Electric\n208-716-1240`,
    )
    : null;
  const results = await Promise.allSettled([
    sendSms(businessSmsTo.value(), `New Scott Lind Electric web lead\n${details}`),
    sendEmail(businessEmailTo.value(), `New web lead from ${lead.name}`, details),
    customerSms,
    ...(customerEmail ? [customerEmail] : []),
  ]);
  const notifications = {
    sms: results[0].status === 'fulfilled' ? 'sent' : 'failed',
    email: results[1].status === 'fulfilled' ? 'sent' : 'failed',
    customerSms: smsConsent ? (results[2].status === 'fulfilled' ? 'sent' : 'failed') : 'skipped',
    customerEmail: lead.email ? (results[3]?.status === 'fulfilled' ? 'sent' : 'failed') : 'skipped',
  };
  const delivered = [notifications.sms, notifications.email].filter((value) => value === 'sent').length;
  const customerConfirmations = {
    sms: notifications.customerSms,
    email: notifications.customerEmail,
  };
  await leadRef.update({ notifications, notificationUpdatedAt: FieldValue.serverTimestamp() });
  if (!delivered) return { status: 502, body: { error: 'Your information was saved, but alerts could not be delivered.', saved: true } };
  return { status: 200, body: { ok: true, saved: true, delivered, notifications, customerConfirmations } };
}

type AddressMatch = { address: string; city: string; state: string };

async function fetchAddressMatches(address: string): Promise<AddressMatch[]> {
  const url = new URL('https://geocoding.geo.census.gov/geocoder/locations/onelineaddress');
  url.search = new URLSearchParams({ address, benchmark: 'Public_AR_Current', format: 'json' }).toString();
  const providerResponse = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!providerResponse.ok) throw new Error(`Address provider returned ${providerResponse.status}`);
  const data = await providerResponse.json() as {
    result?: { addressMatches?: Array<{
      matchedAddress?: unknown;
      addressComponents?: { city?: unknown; state?: unknown };
    }> };
  };
  return (data.result?.addressMatches ?? []).flatMap((match) => {
    const matchedAddress = clean(match.matchedAddress, 200);
    const city = clean(match.addressComponents?.city, 100);
    const state = clean(match.addressComponents?.state, 10);
    return matchedAddress && city && state ? [{ address: matchedAddress, city, state: state.toUpperCase() }] : [];
  }).slice(0, 5);
}

async function findAddressMatches(query: string) {
  const directMatches = await fetchAddressMatches(query);
  const includesState = /\b(?:Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)\b|(?:,\s*|\s)(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)(?:\s+\d{5}(?:-\d{4})?|\s*$)/i.test(query);
  if (directMatches.length || includesState) return directMatches;
  return fetchAddressMatches(`${query}, Idaho`);
}

async function searchAddresses(value: unknown) {
  const query = clean(value, 200);
  if (!query || query.length < 6) {
    return { status: 400, body: { error: 'Enter a street address to look up.' } };
  }
  const matches = await findAddressMatches(query);
  return { status: 200, body: { matches } };
}

async function storeAdLead(body: Record<string, unknown>) {
  if (clean(body.company, 100)) return { status: 200, body: { ok: true } };
  const name = clean(body.name, 100);
  const phone = clean(body.phone, 40);
  const email = clean(body.email, 200);
  const location = clean(body.location, 200);
  const issue = clean(body.issue, 1000);
  const serviceCategory = clean(body.serviceCategory, 40);
  const preferredContact = clean(body.preferredContact, 20)?.toLowerCase();
  const smsConsent = body.smsConsent === true;
  const allowedServices = ['residential', 'commercial', 'same-day', 'after-hours'];
  const allowedContact = ['text', 'email', 'phone'];

  if (!name || !phone || !email || !location || !issue || !serviceCategory || !preferredContact) {
    return { status: 400, body: { error: 'Complete all required fields before sending your request.' } };
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return { status: 400, body: { error: 'Enter a valid email address.' } };
  }
  if (!allowedServices.includes(serviceCategory) || !allowedContact.includes(preferredContact)) {
    return { status: 400, body: { error: 'Choose a valid service type and preferred contact method.' } };
  }
  if (preferredContact === 'text' && !smsConsent) {
    return { status: 400, body: { error: 'To choose Text as your preferred contact method, check the optional SMS consent box or select Email or Phone.' } };
  }

  const matches = await findAddressMatches(location);
  const match = matches[0];
  const zip = location.match(/\b(\d{5})(?:-\d{4})?\b/)?.[1] ?? null;
  const idahoZip = Boolean(zip && /^83[2-8]\d{2}$/.test(zip));
  if ((match && match.state !== 'ID') || (zip && !idahoZip)) {
    return { status: 400, body: { error: 'That location is outside Idaho and outside our service area.' } };
  }
  const explicitlyIdaho = /\bIdaho\b|(?:,\s*|\s)ID(?:\s+\d{5}|\s*$)/i.test(location);
  if (!match && !idahoZip && !explicitlyIdaho) {
    return { status: 400, body: { error: 'Enter a complete Idaho service address or an Idaho ZIP code.' } };
  }

  const lead: Lead = {
    name, phone, email,
    address: match?.address ?? location,
    city: match?.city ?? null,
    state: 'ID',
    addressConfirmed: true,
    issue,
    serviceType: serviceCategory === 'commercial' ? 'commercial' : serviceCategory === 'residential' ? 'residential' : 'urgent',
  };
  return storeAndNotify(lead, body.source ?? 'Google Ads request-service landing page', body.requestId, true, {
    smsConsent, preferredContact, serviceCategory,
  });
}

function isAffirmative(value: string) {
  return /^(yes|yep|yeah|correct|that'?s correct|right|looks? (?:good|right)|it is)\b/i.test(value.trim());
}

function isNegative(value: string) {
  return /^(no|nope|incorrect|wrong|not correct|that'?s wrong)\b/i.test(value.trim());
}

export const serviceAgent = onRequest({
  region: 'us-central1', timeoutSeconds: 60, maxInstances: 10,
  secrets: [openaiApiKey, resendApiKey, twilioAccountSid, twilioAuthToken],
}, async (request, response) => {
  const originAllowed = setCors(request.get('origin'), response);
  if (request.method === 'OPTIONS') { response.status(originAllowed ? 204 : 403).send(''); return; }
  if (!originAllowed) { response.status(403).json({ error: 'Origin not allowed.' }); return; }
  if (request.method !== 'POST') { response.status(405).json({ error: 'Method not allowed.' }); return; }

  const body = request.body && typeof request.body === 'object' ? request.body as Record<string, unknown> : {};
  const lead = cleanLead(body.lead ?? EMPTY_LEAD);
  try {
    if (body.action === 'adLead') {
      const result = await storeAdLead(body);
      response.status(result.status).json(result.body); return;
    }
    if (body.action === 'notify') {
      const result = await storeAndNotify(lead, body.source, body.requestId, body.consent);
      response.status(result.status).json(result.body); return;
    }
    if (body.action === 'addressSearch') {
      const result = await searchAddresses(body.query);
      response.status(result.status).json(result.body); return;
    }
    const messages = cleanMessages(body.messages);
    const lastMessage = messages.at(-1)?.content ?? '';
    if (!lastMessage) { response.status(400).json({ error: 'A message is required.' }); return; }
    if (isDangerous(lastMessage)) {
      response.json({ reply: 'Please move away from the electrical hazard. If there is fire, smoke, injury, or immediate danger, call 911 now. For a downed line, stay well clear and call your utility. Once you are safe, call Scott Lind Electric at 208-716-1240.', ready: false, emergency: true, requestedFields: [], lead });
      return;
    }
    if (lead.address && !lead.addressConfirmed) {
      if (isNegative(lastMessage)) {
        const revisedLead = { ...lead, address: null, city: null, state: null, addressConfirmed: false };
        response.json({ reply: 'No problem. Please type the full service address again, including the city, state, and ZIP code.', ready: false, emergency: false, outOfArea: false, requestedFields: [], lead: revisedLead });
        return;
      }
      if (!isAffirmative(lastMessage)) {
        response.json({ reply: `Please answer yes or no: is ${lead.address} the correct service address?`, ready: false, emergency: false, outOfArea: false, requestedFields: [], lead });
        return;
      }
      lead.addressConfirmed = true;
    }
    const client = new OpenAI({ apiKey: openaiApiKey.value() });
    const aiResponse = await client.responses.create({
      model: openaiModel.value(), store: false, instructions: SYSTEM_PROMPT,
      input: `Known lead details:\n${JSON.stringify(lead)}\n\nConversation:\n${JSON.stringify(messages)}`,
      text: { format: { type: 'json_schema', name: 'service_intake', strict: true, schema: intakeSchema } },
    });
    const result = JSON.parse(aiResponse.output_text) as { reply: string; ready: boolean; emergency: boolean; requestedFields: RequestedField[]; lead: Lead };
    const resultLead = cleanLead(result.lead);
    if (resultLead.address && !lead.address && !resultLead.addressConfirmed) {
      const matches = await findAddressMatches([resultLead.address, resultLead.city, resultLead.state].filter(Boolean).join(', '));
      const match = matches[0];
      if (match) {
        resultLead.address = match.address;
        resultLead.city = match.city;
        resultLead.state = match.state;
      }
      const state = (match?.state ?? resultLead.state ?? '').toUpperCase();
      if (state && state !== 'ID' && state !== 'IDAHO') {
        response.json({ reply: 'Thanks for checking with us. That address is outside Idaho, so it is outside Scott Lind Electric’s service area. Please contact a licensed electrician who serves your area.', ready: false, emergency: false, outOfArea: true, requestedFields: [], lead: resultLead });
        return;
      }
      if (!state) {
        resultLead.address = null;
        resultLead.city = null;
        resultLead.state = null;
        response.json({ reply: 'I couldn’t confirm that location. Please type the full service address, including the city, state, and ZIP code.', ready: false, emergency: false, outOfArea: false, requestedFields: [], lead: resultLead });
        return;
      }
      response.json({ reply: `I found ${resultLead.address}. Is this the correct service address?`, ready: false, emergency: false, outOfArea: false, requestedFields: [], lead: resultLead });
      return;
    }
    resultLead.addressConfirmed = lead.addressConfirmed;
    const ready = Boolean(resultLead.name && resultLead.phone && resultLead.issue && resultLead.address && resultLead.addressConfirmed);
    response.json({ ...result, ready, outOfArea: false, requestedFields: [], lead: resultLead });
  } catch (error) {
    console.error('serviceAgent failed', error);
    response.status(502).json({ error: 'The assistant is temporarily unavailable. Please call 208-716-1240.' });
  }
});

type GoogleReview = { reviewer?: { displayName?: string }; starRating?: string; comment?: string; createTime?: string; updateTime?: string };
const starNumbers: Record<string, number> = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

export const googleReviews = onRequest({
  region: 'us-central1', timeoutSeconds: 30, maxInstances: 5,
  secrets: ['GOOGLE_BUSINESS_CLIENT_ID', 'GOOGLE_BUSINESS_CLIENT_SECRET', 'GOOGLE_BUSINESS_REFRESH_TOKEN'],
}, async (request, response) => {
  response.set('Access-Control-Allow-Origin', '*');
  response.set('Cache-Control', 'public, max-age=900, s-maxage=3600, stale-while-revalidate=86400');
  if (request.method !== 'GET') { response.status(405).json({ error: 'Method not allowed.' }); return; }
  try {
    const pageSize = Math.min(Math.max(Number(request.query.pageSize) || 6, 1), 50);
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_BUSINESS_CLIENT_ID ?? '',
        client_secret: process.env.GOOGLE_BUSINESS_CLIENT_SECRET ?? '',
        refresh_token: process.env.GOOGLE_BUSINESS_REFRESH_TOKEN ?? '',
        grant_type: 'refresh_token',
      }),
    });
    if (!tokenResponse.ok) throw new Error(`Google OAuth returned ${tokenResponse.status}`);
    const token = await tokenResponse.json() as { access_token?: string };
    if (!token.access_token) throw new Error('Google OAuth returned no access token');
    const reviewsUrl = new URL(`https://mybusiness.googleapis.com/v4/accounts/${process.env.GOOGLE_BUSINESS_ACCOUNT_ID}/locations/${process.env.GOOGLE_BUSINESS_LOCATION_ID}/reviews`);
    reviewsUrl.searchParams.set('pageSize', String(pageSize));
    reviewsUrl.searchParams.set('orderBy', 'updateTime desc');
    if (typeof request.query.pageToken === 'string') reviewsUrl.searchParams.set('pageToken', request.query.pageToken);
    const reviewsResponse = await fetch(reviewsUrl, { headers: { Authorization: `Bearer ${token.access_token}` } });
    if (!reviewsResponse.ok) throw new Error(`Google reviews returned ${reviewsResponse.status}`);
    const data = await reviewsResponse.json() as { reviews?: GoogleReview[]; averageRating?: number; totalReviewCount?: number; nextPageToken?: string };
    const reviews = (data.reviews ?? []).map((review) => ({
      by: review.reviewer?.displayName || 'Google customer', quote: review.comment || '',
      rating: starNumbers[review.starRating || ''] || 5, publishedAt: review.updateTime || review.createTime || '',
      relativeTime: review.updateTime || review.createTime ? new Intl.RelativeTimeFormat('en', { numeric: 'auto' }).format(-Math.max(0, Math.round((Date.now() - Date.parse(review.updateTime || review.createTime || '')) / 86400000)), 'day') : '',
    }));
    response.json({ reviews, averageRating: data.averageRating, totalReviewCount: data.totalReviewCount, nextPageToken: data.nextPageToken });
  } catch (error) {
    console.error('googleReviews failed', error);
    response.status(502).json({ error: 'Google reviews are temporarily unavailable.' });
  }
});

type SocialPost = { text: string; theme: 'education' | 'promotion' };
type TaggedSocialPost = SocialPost & { city: string };

function comparableSocialText(text: string) {
  return text
    .replace(/(?:^|\s)#[\p{L}\p{N}_]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function addSocialHashtags(post: SocialPost, recentPosts: string[]): TaggedSocialPost {
  const recentlyUsed = recentPosts.slice(0, 6).map((text) => text.toLowerCase());
  const unusedCities = SOCIAL_CITY_TAGS.filter(({ hashtag }) =>
    !recentlyUsed.some((text) => text.includes(hashtag.toLowerCase()))
  );
  const candidates = unusedCities.length ? unusedCities : SOCIAL_CITY_TAGS;
  const location = candidates[randomInt(candidates.length)];
  const themeTag = post.theme === 'education' ? '#ElectricalSafety' : '#IdahoElectrician';
  const text = `${post.text}\n\n#ScottLindElectric ${themeTag} ${location.hashtag}`;

  if (Array.from(text).length > 280) {
    throw new Error('Generated X post exceeded 280 characters after hashtags were added');
  }
  return { ...post, text, city: location.city };
}

function oauthEncode(value: string) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`);
}

function xAuthorizationHeader(method: string, url: string) {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: xApiKey.value(),
    oauth_nonce: randomUUID().replaceAll('-', ''),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(Math.floor(Date.now() / 1000)),
    oauth_token: xAccessToken.value(),
    oauth_version: '1.0',
  };
  const parameterString = Object.entries(oauthParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${oauthEncode(key)}=${oauthEncode(value)}`)
    .join('&');
  const signatureBase = [method.toUpperCase(), oauthEncode(url), oauthEncode(parameterString)].join('&');
  const signingKey = `${oauthEncode(xApiSecret.value())}&${oauthEncode(xAccessTokenSecret.value())}`;
  oauthParams.oauth_signature = createHmac('sha1', signingKey).update(signatureBase).digest('base64');
  return `OAuth ${Object.entries(oauthParams)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${oauthEncode(key)}="${oauthEncode(value)}"`)
    .join(', ')}`;
}

async function publishToX(text: string) {
  const endpoint = 'https://api.x.com/2/tweets';
  const providerResponse = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: xAuthorizationHeader('POST', endpoint),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text, made_with_ai: true }),
  });
  const data = await providerResponse.json() as {
    data?: { id?: string; text?: string };
    detail?: string;
    title?: string;
    errors?: Array<{ detail?: string; message?: string }>;
  };
  if (!providerResponse.ok || !data.data?.id) {
    const providerMessage = data.detail || data.title || data.errors?.[0]?.detail || data.errors?.[0]?.message;
    throw new Error(`X API returned ${providerResponse.status}${providerMessage ? `: ${providerMessage}` : ''}`);
  }
  return { id: data.data.id, text: data.data.text ?? text };
}

function mountainDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Boise', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}

function mountainPublicationTimestamp(date = new Date()) {
  const dateKey = mountainDateKey(date);
  const offsetName = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Boise', timeZoneName: 'longOffset',
  }).formatToParts(date).find((part) => part.type === 'timeZoneName')?.value;
  const offset = offsetName?.replace('GMT', '');
  if (!offset || !/^[+-]\d{2}:\d{2}$/.test(offset)) {
    throw new Error(`Could not determine the America/Boise UTC offset for ${dateKey}`);
  }
  return `${dateKey}T12:00:00${offset}`;
}

type GitHubFile = {
  type: 'file';
  path: string;
  name: string;
  sha: string;
  encoding?: string;
  content?: string;
};

type BlogContext = {
  existingCoverage: string;
  verifiedSources: string;
  allowedLinks: string[];
};

function githubContentsPath(repoPath: string) {
  return repoPath.split('/').map(encodeURIComponent).join('/');
}

async function githubRequest<T>(
  apiPath: string,
  options: { method?: string; body?: string } = {},
  allowNotFound = false,
): Promise<T | null> {
  const response = await fetch(`https://api.github.com${apiPath}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${githubToken.value()}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Scott-Lind-Electric-weekly-blog-publisher',
    },
    body: options.body,
  });
  if (response.status === 404 && allowNotFound) return null;
  const data = await response.json() as { message?: string };
  if (!response.ok) {
    throw new Error(`GitHub API returned ${response.status}${data.message ? `: ${data.message}` : ''}`);
  }
  return data as T;
}

function repoApiPrefix() {
  return `/repos/${encodeURIComponent(githubOwner.value())}/${encodeURIComponent(githubRepo.value())}`;
}

async function getGithubFile(repoPath: string): Promise<GitHubFile | null> {
  const result = await githubRequest<GitHubFile | GitHubFile[]>(
    `${repoApiPrefix()}/contents/${githubContentsPath(repoPath)}?ref=${encodeURIComponent(githubBranch.value())}`,
    {},
    true,
  );
  return result && !Array.isArray(result) && result.type === 'file' ? result : null;
}

async function getGithubDirectory(repoPath: string): Promise<GitHubFile[]> {
  const result = await githubRequest<GitHubFile[]>(
    `${repoApiPrefix()}/contents/${githubContentsPath(repoPath)}?ref=${encodeURIComponent(githubBranch.value())}`,
  );
  if (!Array.isArray(result)) throw new Error(`${repoPath} was not a GitHub directory`);
  return result.filter((item) => item.type === 'file');
}

function decodeGithubFile(file: GitHubFile) {
  if (file.encoding !== 'base64' || !file.content) {
    throw new Error(`GitHub did not return base64 content for ${file.path}`);
  }
  return Buffer.from(file.content.replace(/\s/g, ''), 'base64').toString('utf8');
}

async function getRepoText(repoPath: string) {
  const file = await getGithubFile(repoPath);
  if (!file) throw new Error(`Required repository source ${repoPath} was not found`);
  return decodeGithubFile(file);
}

function summarizeExistingPost(path: string, content: string) {
  const usefulLines = content.split('\n').filter((line) =>
    /^(title|description|pubDate|tags):/i.test(line.trim()) || /^##\s+/.test(line.trim())
  );
  return `File: ${path}\n${usefulLines.join('\n')}`;
}

async function getBlogContext(): Promise<BlogContext> {
  const blogFiles = (await getGithubDirectory('src/content/blog'))
    .filter((file) => /\.mdx?$/.test(file.name))
    .sort((left, right) => left.name.localeCompare(right.name));
  const postContents = await Promise.all(blogFiles.map(async (file) => ({
    file,
    content: await getRepoText(file.path),
  })));
  const sourcePaths = [
    'src/consts.ts',
    'src/pages/residential.astro',
    'src/pages/commercial.astro',
    'src/pages/after-hours.astro',
    'src/pages/service-area/index.astro',
  ];
  const sourceContents = await Promise.all(sourcePaths.map(async (path) => ({
    path,
    content: await getRepoText(path),
  })));
  return {
    existingCoverage: postContents
      .map(({ file, content }) => summarizeExistingPost(file.path, content))
      .join('\n\n'),
    verifiedSources: sourceContents
      .map(({ path, content }) => `--- ${path} ---\n${content}`)
      .join('\n\n'),
    allowedLinks: [
      '/residential/', '/commercial/', '/after-hours/', '/answers/', '/service-area/',
      '/service-area/idaho-falls/', '/service-area/ammon/', '/contact/', '/blog/',
      ...blogFiles.map((file) => `/blog/${file.name.replace(/\.mdx?$/, '')}/`),
    ],
  };
}

function wordCount(markdown: string) {
  return markdown.match(/[\p{L}\p{N}][\p{L}\p{N}’'-]*/gu)?.length ?? 0;
}

function validateBlogPost(post: GeneratedBlogPost, context: BlogContext) {
  post.title = post.title.trim().replace(/\s+/g, ' ');
  post.description = post.description.trim().replace(/\s+/g, ' ');
  post.slug = post.slug.trim().toLowerCase();
  post.searchIntent = post.searchIntent.trim().replace(/\s+/g, ' ');
  post.tags = [...new Set(post.tags.map((tag) => tag.trim()).filter(Boolean))];
  post.body = post.body.trim();

  if (post.title.length > 70) throw new Error('Generated blog title exceeded 70 characters');
  if (post.description.length < 80 || post.description.length > 165) {
    throw new Error('Generated blog description was outside 80 to 165 characters');
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(post.slug)) throw new Error('Generated blog slug was invalid');
  if (!BLOG_CATEGORIES.includes(post.category)) throw new Error('Generated blog category was invalid');
  if (post.tags.length < 3 || post.tags.length > 5 || post.tags.some((tag) => tag.length > 40)) {
    throw new Error('Generated blog tags were invalid');
  }
  const words = wordCount(post.body);
  if (words < 900 || words > 1400) throw new Error(`Generated blog body contained ${words} words`);
  if ((post.body.match(/^##\s+.+$/gm) ?? []).length < 4) {
    throw new Error('Generated blog body did not contain at least four H2 sections');
  }
  if (/^#\s+/m.test(post.body)) throw new Error('Generated blog body included an H1');
  if (/^---\s*$/m.test(post.body) || /```|<\/?[a-z][^>]*>/i.test(post.body)) {
    throw new Error('Generated blog body included disallowed frontmatter, HTML, or code fences');
  }
  const links = [...post.body.matchAll(/\[[^\]]+\]\(([^)\s]+)\)/g)].map((match) => match[1]);
  const internalLinks = links.filter((link) => link.startsWith('/'));
  if (internalLinks.length < 2) throw new Error('Generated blog body did not include two internal links');
  const allowedLinks = new Set(context.allowedLinks);
  if (links.some((link) => !allowedLinks.has(link))) {
    throw new Error('Generated blog body included an external or unapproved link');
  }
  const existingTitleLines = context.existingCoverage.match(/^title:\s*['"]?(.+?)['"]?\s*$/gim) ?? [];
  if (existingTitleLines.some((line) => line.replace(/^title:\s*['"]?|['"]?\s*$/gi, '').toLowerCase() === post.title.toLowerCase())) {
    throw new Error('Generated blog title duplicated an existing post');
  }
  return post;
}

async function createBlogPost(context: BlogContext, dateKey: string, correction = '') {
  const client = new OpenAI({ apiKey: openaiApiKey.value() });
  const aiResponse = await client.responses.create({
    model: openaiModel.value(),
    store: false,
    instructions: BLOG_POST_PROMPT,
    input: `Publication date in America/Boise: ${dateKey}

Allowed categories: ${BLOG_CATEGORIES.join(', ')}

Allowed internal links (use exact URLs):
${context.allowedLinks.map((link) => `- ${link}`).join('\n')}

Existing blog coverage to avoid duplicating:
${context.existingCoverage}

Verified repository sources. These are the only allowed source of business facts:
${context.verifiedSources}
${correction ? `\nThe prior draft was rejected. Correct this issue in a fresh draft: ${correction}` : ''}`,
    text: { format: { type: 'json_schema', name: 'weekly_blog_post', strict: true, schema: blogPostSchema } },
  });
  return validateBlogPost(JSON.parse(aiResponse.output_text) as GeneratedBlogPost, context);
}

function buildBlogMarkdown(post: GeneratedBlogPost, publicationTimestamp: string) {
  return [
    '---',
    `title: ${JSON.stringify(post.title)}`,
    `description: ${JSON.stringify(post.description)}`,
    `pubDate: ${publicationTimestamp}`,
    `tags: ${JSON.stringify(post.tags)}`,
    'draft: false',
    '---',
    '',
    post.body,
    '',
  ].join('\n');
}

function contentHash(content: string) {
  return createHash('sha256').update(content).digest('hex');
}

async function commitNewGithubFile(repoPath: string, content: string, message: string) {
  const existing = await getGithubFile(repoPath);
  if (existing) {
    const existingContent = decodeGithubFile(existing);
    if (existingContent === content) return { sha: existing.sha, alreadyExisted: true };
    throw new Error(`Refusing to overwrite existing GitHub file ${repoPath}`);
  }
  const result = await githubRequest<{ commit?: { sha?: string } }>(
    `${repoApiPrefix()}/contents/${githubContentsPath(repoPath)}`,
    {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: Buffer.from(content, 'utf8').toString('base64'),
        branch: githubBranch.value(),
      }),
    },
  );
  const sha = result?.commit?.sha;
  if (!sha) throw new Error('GitHub did not return a commit identifier for the new blog post');
  return { sha, alreadyExisted: false };
}

async function createSocialPost(
  recentPosts: string[],
  targetTheme: SocialPost['theme'],
): Promise<SocialPost> {
  const client = new OpenAI({ apiKey: openaiApiKey.value() });
  const aiResponse = await client.responses.create({
    model: openaiModel.value(),
    store: false,
    instructions: SOCIAL_POST_PROMPT,
    input: `The required theme for this post is ${targetTheme}.\n${recentPosts.length
      ? `Recent posts to avoid repeating:\n${recentPosts.map((post, index) => `${index + 1}. ${post}`).join('\n')}`
      : 'There are no recent automated posts.'}`,
    text: { format: { type: 'json_schema', name: 'social_post', strict: true, schema: socialPostSchema } },
  });
  const result = JSON.parse(aiResponse.output_text) as SocialPost;
  const text = result.text.trim();
  if (!text || Array.from(text).length > 210) throw new Error('Generated X post was empty or exceeded 210 characters before hashtags');
  if (/(?:^|\s)#[\p{L}\p{N}_]+/u.test(text)) throw new Error('Generated X post included a hashtag reserved for the publishing system');
  if (result.theme !== targetTheme) throw new Error(`Generated X post used ${result.theme} instead of ${targetTheme}`);
  if (recentPosts.some((recent) => comparableSocialText(recent) === comparableSocialText(text))) {
    throw new Error('Generated X post duplicated a recent post');
  }
  return { text, theme: result.theme };
}

export const publishScheduledXPost = onSchedule({
  schedule: '0 8 * * 1,4',
  timeZone: 'America/Boise',
  region: 'us-central1',
  timeoutSeconds: 120,
  secrets: [openaiApiKey, xApiKey, xApiSecret, xAccessToken, xAccessTokenSecret],
}, async () => {
  const dateKey = mountainDateKey();
  const postRef = db.collection('socialPosts').doc(dateKey);
  const shouldRun = await db.runTransaction(async (transaction) => {
    const existing = await transaction.get(postRef);
    const status = existing.get('status');
    if (status && status !== 'failed') return false;
    transaction.set(postRef, {
      status: 'generating', attemptStartedAt: FieldValue.serverTimestamp(), error: FieldValue.delete(),
    }, { merge: true });
    return true;
  });
  if (!shouldRun) {
    console.log(`X post job already started for ${dateKey}; skipping duplicate run`);
    return;
  }

  try {
    const recentSnapshot = await db.collection('socialPosts')
      .orderBy('createdAt', 'desc')
      .limit(30)
      .get();
    const postedDocs = recentSnapshot.docs.filter((doc) => doc.get('status') === 'posted');
    const recentPosts = postedDocs.flatMap((doc) => {
      const text = doc.get('text');
      return typeof text === 'string' ? [text] : [];
    }).slice(0, 12);
    const previousTheme = postedDocs[0]?.get('theme');
    const targetTheme: SocialPost['theme'] = previousTheme === 'education' ? 'promotion' : 'education';
    const generatedPost = await createSocialPost(recentPosts, targetTheme);
    const post = addSocialHashtags(generatedPost, recentPosts);
    await postRef.set({ ...post, status: 'drafted', createdAt: FieldValue.serverTimestamp() }, { merge: true });
    const published = await publishToX(post.text);
    await postRef.set({
      status: 'posted', xPostId: published.id, text: published.text,
      postedAt: FieldValue.serverTimestamp(), error: FieldValue.delete(),
    }, { merge: true });
    console.log(`Published X post ${published.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await postRef.set({ status: 'failed', error: message, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    console.error('publishScheduledXPost failed', error);
    throw error;
  }
});

export const publishScheduledBlogPost = onSchedule({
  schedule: '0 19 * * 0',
  timeZone: 'America/Boise',
  region: 'us-central1',
  timeoutSeconds: 540,
  memory: '512MiB',
  retryCount: 2,
  minBackoffSeconds: 60,
  maxBackoffSeconds: 300,
  maxRetrySeconds: 900,
  secrets: [openaiApiKey, githubToken],
}, async () => {
  const dateKey = mountainDateKey();
  const runRef = db.collection('blogPublisherRuns').doc(dateKey);

  try {
    const priorRun = await runRef.get();
    if (priorRun.get('status') === 'posted') {
      console.log(`Blog post already published for ${dateKey}; skipping duplicate run`);
      return;
    }

    const priorPath = priorRun.get('filePath');
    const priorHash = priorRun.get('contentHash');
    if (typeof priorPath === 'string' && typeof priorHash === 'string') {
      const existingFile = await getGithubFile(priorPath);
      if (existingFile && contentHash(decodeGithubFile(existingFile)) === priorHash) {
        await runRef.set({
          status: 'posted', githubCommit: priorRun.get('githubCommit') ?? existingFile.sha,
          recoveredAfterCommit: true, postedAt: FieldValue.serverTimestamp(), error: FieldValue.delete(),
        }, { merge: true });
        console.log(`Recovered completed blog publication for ${priorPath}`);
        return;
      }
    }

    const shouldRun = await db.runTransaction(async (transaction) => {
      const current = await transaction.get(runRef);
      const status = current.get('status');
      if (status === 'posted') return false;
      const attemptStartedAt = current.get('attemptStartedAt') as { toMillis?: () => number } | undefined;
      const startedMillis = attemptStartedAt?.toMillis?.() ?? 0;
      if ((status === 'generating' || status === 'committing') && startedMillis > Date.now() - 30 * 60 * 1000) {
        return false;
      }
      transaction.set(runRef, {
        status: 'generating',
        attemptStartedAt: FieldValue.serverTimestamp(),
        error: FieldValue.delete(),
      }, { merge: true });
      return true;
    });
    if (!shouldRun) {
      console.log(`Blog post job is already running for ${dateKey}; skipping duplicate invocation`);
      return;
    }

    const context = await getBlogContext();
    let post: GeneratedBlogPost | undefined;
    let correction = '';
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      try {
        post = await createBlogPost(context, dateKey, correction);
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === 2) throw error;
        correction = message;
        console.warn(`Rejected generated blog draft on attempt ${attempt}: ${message}`);
      }
    }
    if (!post) throw new Error('Blog generation completed without a valid post');

    const publicationTimestamp = mountainPublicationTimestamp();
    const markdown = buildBlogMarkdown(post, publicationTimestamp);
    const filePath = `src/content/blog/${post.slug}.md`;
    const markdownHash = contentHash(markdown);
    await runRef.set({
      status: 'committing',
      title: post.title,
      slug: post.slug,
      category: post.category,
      searchIntent: post.searchIntent,
      tags: post.tags,
      filePath,
      publicationTimestamp,
      contentHash: markdownHash,
      wordCount: wordCount(post.body),
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    const committed = await commitNewGithubFile(filePath, markdown, `Publish weekly blog: ${post.title}`);
    await runRef.set({
      status: 'posted',
      githubCommit: committed.sha,
      alreadyExisted: committed.alreadyExisted,
      postedAt: FieldValue.serverTimestamp(),
      error: FieldValue.delete(),
    }, { merge: true });
    console.log(`Published weekly blog post ${filePath} in commit ${committed.sha}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await runRef.set({
      status: 'failed', error: message.slice(0, 2000), updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    console.error('publishScheduledBlogPost failed', error);
    throw error;
  }
});
