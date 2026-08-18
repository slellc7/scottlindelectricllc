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
  issue: string | null;
  serviceType: 'residential' | 'commercial' | 'urgent' | null;
};

type ChatMessage = { role: 'user' | 'assistant'; content: string };
type RequestedField = 'name' | 'phone' | 'email' | 'address';

const EMPTY_LEAD: Lead = {
  name: null, phone: null, email: null, address: null,
  city: null, issue: null, serviceType: null,
};

const SYSTEM_PROMPT = `You are the website lead coordinator for Scott Lind Electric LLC in Idaho Falls, Idaho.

Briefly and warmly collect a potential customer's name, phone, optional email, service address, the electrical problem, and whether it is residential, commercial, or urgent. Ask one or two related questions at a time. Never promise an arrival time, price, diagnosis, or code compliance. Never ask a visitor to open a panel, touch wiring, test live equipment, or take any electrical risk.

Whenever you ask for name, phone, email, or address, tell the visitor to complete the form shown below and list those exact fields in requestedFields. Do not ask them to type contact details into chat. Prefer name and phone together, followed by email and address together. Email is optional; if the conversation says it was left blank, do not ask for it again. Use an empty requestedFields array when you are not asking for contact information.

If there is smoke, fire, flames, a burning smell, active sparking, a hot or buzzing panel, electrical shock, or a downed power line, tell the visitor to move away, call 911 for fire, injury, or immediate danger, call their utility for a downed line, and call Scott Lind Electric at 208-716-1240 only once safe. Mark emergency true.

Email is optional. A lead is ready when name, phone, issue, and service address are present. When ready, say you have the essentials and ask them to review and send their information to Scott Lind Electric using the button below. Keep replies under 70 words.`;

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
      required: ['name', 'phone', 'email', 'address', 'city', 'issue', 'serviceType'],
      properties: {
        name: { type: ['string', 'null'] }, phone: { type: ['string', 'null'] },
        email: { type: ['string', 'null'] }, address: { type: ['string', 'null'] },
        city: { type: ['string', 'null'] }, issue: { type: ['string', 'null'] },
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
    address: clean(lead.address, 200), city: clean(lead.city, 100), issue: clean(lead.issue, 1000),
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
    `City: ${lead.city ?? 'Not provided'}`, `Type: ${lead.serviceType ?? 'Not specified'}`,
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

async function storeAndNotify(lead: Lead, source: unknown, requestId: unknown, consent: unknown) {
  if (!lead.name || !lead.phone || !lead.issue || !lead.address) {
    return { status: 400, body: { error: 'Name, phone, problem, and service address are required.' } };
  }
  if (consent !== true) {
    return { status: 400, body: { error: 'Consent is required before sending this request.' } };
  }
  const id = typeof requestId === 'string' && /^[a-zA-Z0-9_-]{8,80}$/.test(requestId) ? requestId : randomUUID();
  const leadRef = db.collection('leads').doc(id);
  await leadRef.set({ ...lead, source: clean(source, 300) ?? 'AI website assistant', consent: true,
    consentChannels: { phone: true, sms: true, email: Boolean(lead.email) },
    status: 'new', createdAt: FieldValue.serverTimestamp(), notifications: {
      sms: 'pending', email: 'pending', customerSms: 'pending', customerEmail: lead.email ? 'pending' : 'skipped',
    } });

  const details = leadText(lead);
  const customerPhone = normalizeUsPhone(lead.phone);
  const customerSms = customerPhone
    ? sendSms(customerPhone, 'Scott Lind Electric: We received your electrical service request. Scott will contact you directly. This is not an appointment confirmation. Reply STOP to opt out or HELP for help. Call 208-716-1240.')
    : Promise.reject(new Error('Customer phone number is not a valid US number.'));
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
    customerSms: results[2].status === 'fulfilled' ? 'sent' : 'failed',
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

async function searchAddresses(value: unknown) {
  const query = clean(value, 200);
  if (!query || query.length < 6) {
    return { status: 400, body: { error: 'Enter a street address to look up.' } };
  }
  const address = /\b(idaho|id)\b/i.test(query) ? query : `${query}, Idaho`;
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
  const matches = (data.result?.addressMatches ?? []).flatMap((match) => {
    const matchedAddress = clean(match.matchedAddress, 200);
    const city = clean(match.addressComponents?.city, 100);
    const state = clean(match.addressComponents?.state, 10);
    return matchedAddress && city && state === 'ID' ? [{ address: matchedAddress, city }] : [];
  }).slice(0, 5);
  return { status: 200, body: { matches } };
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
    const client = new OpenAI({ apiKey: openaiApiKey.value() });
    const aiResponse = await client.responses.create({
      model: openaiModel.value(), store: false, instructions: SYSTEM_PROMPT,
      input: `Known lead details:\n${JSON.stringify(lead)}\n\nConversation:\n${JSON.stringify(messages)}`,
      text: { format: { type: 'json_schema', name: 'service_intake', strict: true, schema: intakeSchema } },
    });
    const result = JSON.parse(aiResponse.output_text) as { reply: string; ready: boolean; emergency: boolean; requestedFields: RequestedField[]; lead: Lead };
    const requestedFields = Array.isArray(result.requestedFields)
      ? result.requestedFields.filter((field): field is RequestedField => ['name', 'phone', 'email', 'address'].includes(field)).slice(0, 2)
      : [];
    response.json({ ...result, requestedFields, lead: cleanLead(result.lead) });
  } catch (error) {
    console.error('serviceAgent failed', error);
    response.status(502).json({ error: 'The assistant is temporarily unavailable. Please call 208-716-1240.' });
  }
});
