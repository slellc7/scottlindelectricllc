# Firebase AI customer-lead agent

## Architecture

- **Astro on Netlify** continues serving the existing website and estimate forms.
- **Firebase Functions (2nd gen)** runs the AI intake endpoint and keeps all provider secrets on the server.
- **Cloud Firestore** stores confirmed leads in a private `leads` collection.
- **OpenAI Responses API** returns a short reply and structured lead fields.
- **Twilio** texts the lead details to the business.
- **Resend** emails the same details to the business.

The visitor's browser calls the Firebase `serviceAgent` function directly. CORS permits the live website and the documented local development origins. Firestore rules deny all browser access; the trusted Admin SDK in the function is the only writer.

## Environment files

There are three templates because browser configuration and server secrets have different security requirements.

| Template | Copy to | Purpose |
| --- | --- | --- |
| root `.env.example` | root `.env` | Public Firebase function URL used by Astro |
| `functions/.env.example` | `functions/.env.local` | Non-secret emulator configuration |
| `functions/.secret.local.example` | `functions/.secret.local` | Emulator-only API secrets |

Real `.env`, `.env.local`, `.secret.local`, and `.firebaserc` files are ignored by Git. Never put an OpenAI, Twilio, or Resend secret in the root public environment file.

`PUBLIC_AI_CHAT_ENABLED` is a deployment switch. The production build is enabled unless this value is explicitly set to `false`, which removes the launcher, panel, and chat script from the built website.

## Firebase project setup

1. Create or select a Firebase project and enable Firestore in the Firebase console.
2. Upgrade to the Blaze plan, which is needed to deploy Cloud Functions that call external services.
3. Install dependencies with `npm install` and `npm --prefix functions install`.
4. Sign in with `npx firebase login`.
5. Run `npx firebase use --add`, select the project, and use `default` as the alias. This creates the ignored `.firebaserc` file.
6. Set production secrets from the repository root:

```bash
npx firebase functions:secrets:set OPENAI_API_KEY
npx firebase functions:secrets:set RESEND_API_KEY
npx firebase functions:secrets:set TWILIO_ACCOUNT_SID
npx firebase functions:secrets:set TWILIO_AUTH_TOKEN
```

The function declares its non-secret settings as Firebase parameters. On the first deploy, Firebase prompts for missing values and writes them to a project-specific functions environment file:

- `OPENAI_MODEL`
- `ALLOWED_ORIGINS`
- `RESEND_FROM_EMAIL`
- `BUSINESS_EMAIL_TO`
- `TWILIO_FROM_NUMBER`
- `BUSINESS_SMS_TO`

## Local testing

Copy the three example files:

```bash
cp .env.example .env
cp functions/.env.example functions/.env.local
cp functions/.secret.local.example functions/.secret.local
```

Replace `YOUR_PROJECT_ID` in the root `.env` with the Firebase project ID and fill in both files under `functions/`. Then start Firebase in one terminal:

```bash
npm run firebase:emulators
```

Start Astro in another terminal:

```bash
npm run dev
```

Open `http://localhost:4321`. The Firebase Emulator UI is at `http://localhost:4000`; confirmed test leads appear in its `leads` collection. Twilio and Resend calls are real when real sandbox or test credentials are used.

## Deployment

Deploy the function, Firestore rules, and indexes:

```bash
npm run firebase:deploy
```

The production `serviceAgent` URL is the component's safe default. You can override it with Netlify's `PUBLIC_FIREBASE_AGENT_URL` build environment variable when needed. Do not add server secrets to Netlify.

Set Netlify's `PUBLIC_AI_CHAT_ENABLED` value to `false` whenever you need to hide the assistant, then trigger a new Netlify deploy.

## Request flow and safety

1. The browser sends recent chat messages and known lead fields to Firebase.
2. The function catches dangerous phrases before calling the model.
3. The model asks only for missing contact and service details.
4. The visitor reviews the lead and consents to submit it.
5. Firebase stores the lead in Firestore, then sends the business SMS and email alerts.
6. Firestore records whether each notification succeeded.

The OpenAI request uses `store: false`. No transcript is placed in browser storage or Firestore. Test normal residential, commercial, missing-email, smoke/fire, downed-line, provider-failure, and rejected-origin cases before launch. Add App Check or rate limiting before high traffic; CORS alone is not an abuse-control mechanism.
