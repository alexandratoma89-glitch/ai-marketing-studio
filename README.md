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

Dashboard state is in memory and resets on reload. The customer homepage is at `/`; the dashboard is at `/studio` behind HTTP Basic authentication. Set server-only `STUDIO_USERNAME` and a unique `STUDIO_PASSWORD` of at least 24 characters. Without these settings, the studio stays locked (HTTP 503). Authentication uses the browser sign-in dialog over HTTPS. No signup or account recovery is offered. Close the browser session to clear cached Basic credentials; rotate the password to revoke access. No paid APIs, OAuth flow, background generation, or actual publishing is activated. Settings are UI preferences for this session only; they do not change existing sample concepts. No provider credentials are required for the customer demo; private studio access requires the two administrator settings.

`lib/workflow.ts` defines video states, guarded transitions, and provider interfaces for future generators and publishers. Scheduling requires approval, and publishing adapter invocation is guarded. A production backend must enforce authorization and approval against persisted records, validate scheduled dates, track content revisions, and keep credentials server-side. A real provider, durable jobs, storage, OAuth, and authentication belong in later phases.

## Free tarot email flow

A separate public experience now lives at `/tarot-gratuit`; the dashboard is protected at `/studio`.
See [setup, safety gates, consent storage and testing](docs/free-tarot.md).
Development uses a private mock outbox and sample Romanian interpretation. Production sending requires explicit activation flags and all service prerequisites, beyond credentials alone. Supabase, AI, bot verification, booking and subscription destinations still require operator configuration before a real launch.

In Vercel: Project Settings → Environment Variables → add `STUDIO_USERNAME` and `STUDIO_PASSWORD` for Production, then redeploy. Never send the password through chat or commit it. The homepage is public and requires no password. Keep email sending and payment services disabled until separately authorized.

Private launch checklist: `/studio/launch`. It displays configuration presence only. No account connection, mail delivery or transaction has been verified until those operations are tested against the configured services.
