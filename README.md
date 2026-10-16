# Carewell

Carewell is an accessibility-first hospital and care-coordination application. This repository provides a runnable interface preview and optional Supabase-backed authentication, appointment requests, and doctor credential review. It is not a complete clinical system and is not approved for real patient data or care decisions.

## Run locally

Requirements: Node.js 20.9+ and npm.

```powershell
npm install
npm run dev
```

Open `http://localhost:3000`. Without Supabase configuration, users must choose a preview role to enter the demo. The preview role selector is not authentication or access control; actions and synthetic data remain in page memory and are lost on refresh. Never enter patient or emergency information in demo mode.

## Supabase setup

Copy `.env.example` to `.env.local` and configure:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

The client uses only the public anonymous key. Never put a Supabase service-role key or provider credential in a `NEXT_PUBLIC_` variable.

Apply migrations in order to a new Supabase project:

1. `supabase/migrations/20261016000000_initial_schema.sql`
2. `supabase/migrations/20261016093000_doctor_onboarding.sql`

Patient and visitor accounts can register. Doctor applicants enter professional contact details, specialty, qualification, institution, and license information. The account remains a patient/visitor until an administrator verifies the application. Approval publishes the profile in the authenticated doctor directory and changes the applicant's database role to doctor. Applicants may need to sign in again to refresh the role in the interface.

Administrator and other staff access must be provisioned through a trusted project-owner process; sign-up never grants elevated roles. For a first administrator, create and confirm the account, then assign the administrator role to its profile from the Supabase SQL Editor using the verified account UUID. Do not expose or enable user self-assignment. The migration's policies restrict applications to their owner and administrators, and approved directory records to authenticated users. Review and adapt all policies to the organization's tenant model before use.

The administrator review screen relies on a human checking qualifications and the license with the relevant issuing authority. The application does not perform an external license lookup or validate credentials automatically.

## Features and boundaries

- Responsive sign-in, demo preview roles, and mobile navigation.
- Display preferences for light/dark/high-contrast mode, navy/teal/plum palettes, custom accent, font style, text scale, animation, and compact layout. Preferences are saved in local browser storage.
- Doctor directory with specialty filtering, verified profile details, phone/email links, and appointment-request entry point. Email and phone links open the user's configured apps; they do not send automatic notifications.
- Accessible communication board with browser speech synthesis when supported.
- Synthetic clinician photos and demo data are illustrative only. Stock imagery is served from Unsplash under its license; sample names and contact details are fictional.
- Supabase-backed appointment requests and doctor applications/reviews when the schema is configured. Clinical review changes only the review status and never finalizes a suggestion into a medical record.

No Groq, Gemini, OpenRouter, Upstash, email/SMS delivery, wearable, telemedicine, emergency dispatch, or clinical-record integration is active. Credentials previously shared in chat should be revoked and rotated; configure only replacement secrets in a local `.env.local` or a deployment secret manager. Do not send clinical or other sensitive personal information to an AI provider.

Before production use, implement and validate organization isolation, consent, audit logging, encrypted storage, rate limits, backups, provider safeguards, emergency workflows, notification delivery, and clinician authorization. This project is not a HIPAA certification or substitute for a security and clinical-safety review.

## Checks

```powershell
npm run lint
npx tsc --noEmit
npm run build
```
