# Arcana — AI Marketing Studio

Phase 1 marketing workspace for a Romanian tarot guidance business. Next.js App Router, TypeScript, Tailwind CSS, and Lucide icons. Requires Node.js 22.6+ (validated with Node 24) and npm.

## Run

```sh
npm ci
npm run dev
```

Open port 3000 using your development environment's port preview, or visit `http://localhost:3000` on your own machine. For a production build, run `npm run build` then `npm start`.

## Validate

```sh
npm test
npm run typecheck
npm run build
```

## Phase 1 scope

Romanian dashboard, two daily calendar slots, filterable concept library, review and approval dialogs, demo scheduling, social integration placeholders, editable budget with CSV export, and narration/caption/style controls. All content, production counts, and expenses are illustrative. Dates are fixed to 15 October 2026. Video previews are original procedural artwork, not playable generated videos.

Dashboard state is in memory and resets on reload. The customer homepage is at `/`; the dashboard is at `/studio` behind HTTP Basic authentication. Set server-only `STUDIO_USERNAME` and a unique `STUDIO_PASSWORD` of at least 24 characters. Without these settings, the studio stays locked (HTTP 503). Authentication uses the browser sign-in dialog over HTTPS. No signup or account recovery is offered. Close the browser session to clear cached Basic credentials; rotate the password to revoke access. No paid AI APIs, OAuth flow, background video generation, or actual social publishing is activated. Settings are UI preferences for this session only; they do not change existing sample concepts. No provider credentials are required for the customer demo; private studio access requires the two administrator settings.

`lib/workflow.ts` defines video states, guarded transitions, and provider interfaces for future generators and publishers. Scheduling requires approval, and publishing adapter invocation is guarded. A production backend must enforce authorization and approval against persisted records, validate scheduled dates, track content revisions, and keep credentials server-side. A real provider, durable jobs, storage, OAuth, and authentication belong in later phases.

## Free tarot email flow

A separate public experience now lives at `/tarot-gratuit`; the dashboard is protected at `/studio`.
See [setup, safety gates, consent storage and testing](docs/free-tarot.md).
Development uses a private mock outbox and sample Romanian interpretation. All real customer sending is source-locked per the latest instruction; configured test mode uses mock delivery. Supabase, AI, bot verification, booking and subscription destinations still require operator configuration before a real launch.

In Vercel: Project Settings → Environment Variables → add `STUDIO_USERNAME` and `STUDIO_PASSWORD` for Production, then redeploy. Never send the password through chat or commit it. The homepage is public and requires no password. Keep email sending and payment services disabled until separately authorized.

Private launch checklist: `/studio/launch`. It displays configuration presence only. No account connection, mail delivery or transaction has been verified until those operations are tested against the configured services.

## Commercial test integrations

Brevo mock emails, native availability/audio-video bookings, Stripe TEST Checkout and membership, verified webhooks, private management/cancellation, daily delivery worker and delivery logs extend the existing design. Owner controls: `/studio/bookings`; launch settings: `/studio/launch`. No live charges/customer emails are permitted in this release. Full account/API-key/DNS/business checklist and accurate implementation status: [commercial launch guide](docs/commercial-launch.md).

Romanian pricing update (not deployed): private reading **179 lei**, first eligible booking **161,10 lei**, free pull **0 lei**, membership **30 days free then 29 lei/month**. These are final totals; VAT status is unconfirmed and visibly labeled in test mode. Existing contract snapshots are preserved by additive migration 003. See the launch guide before applying it.

Instagram Login and approved Reel scheduling are implemented at `/studio/instagram`. They are disabled until server credentials, the isolated Instagram Supabase migration and explicit publishing authorization are configured. Existing demo videos never enter this queue. See [the numbered Meta and Vercel setup checklist](docs/instagram-setup.md); tests mock Meta and do not establish a real account connection.

A single controlled Runway video test is implemented at `/studio/videos`: Gen-4.5, 5 seconds, 9:16, estimated 60 credits, with a durable server-side reservation before submission and private archival. Paid generation remains disabled by default, there is no automatic daily generation, and Instagram publishing is source-locked during this test. See [the one-video setup and authorization guide](docs/runway-verification.md). Preparing a draft or running the polling worker never submits a paid generation.

Brand accounts and OAuth status are listed at `/studio/social`: Instagram/Facebook/TikTok `@divinework.store`, YouTube `@divine-work`. Facebook, TikTok and YouTube now have encrypted server-side, connection-only OAuth flows; their publishing/upload adapters are not implemented. Instagram retains its existing flow and first-test publication lock. See [social account setup](docs/social-connections.md) for the new migration, official developer apps and exact callbacks. No real connection is implied by the configured public handles or mocked tests.
