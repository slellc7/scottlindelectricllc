import { randomUUID } from 'node:crypto';
import { initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { defineSecret, defineString } from 'firebase-functions/params';
import { onRequest } from 'firebase-functions/v2/https';
import OpenAI from 'openai';

initializeApp();
const db = getFirestore();

const openaiApiKey = defineSecret('OPENAI_API_KEY');
const resendApiKey = defineSecret('RESEND_API_KEY');
const twilioAccountSid = defineSecret('TWILIO_ACCOUNT_SID');
const twilioAuthToken = defineSecret('TWILIO_AUTH_TOKEN');

const openaiModel = defineString('OPENAI_MODEL', { default: 'gpt-5.6' });
const allowedOrigins = defineString('ALLOWED_ORIGINS', {
  default: 'http://localhost:4321,http://localhost:8888,https://scottlindelectric.com,https://www.scottlindelectric.com',
});
const resendFromEmail = defineString('RESEND_FROM_EMAIL');
const businessEmailTo = defineString('BUSINESS_EMAIL_TO');
const twilioFromNumber = defineString('TWILIO_FROM_NUMBER');
const businessSmsTo = defineString('BUSINESS_SMS_TO');

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
