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

Application state is in memory and resets on reload. There is no authentication or backend; do not expose this demo as a private production service. No paid APIs, OAuth flow, background generation, or actual publishing is activated. Settings are UI preferences for this session only; they do not change existing sample concepts. No secrets are required.

`lib/workflow.ts` defines video states, guarded transitions, and provider interfaces for future generators and publishers. Scheduling requires approval, and publishing adapter invocation is guarded. A production backend must enforce authorization and approval against persisted records, validate scheduled dates, track content revisions, and keep credentials server-side. A real provider, durable jobs, storage, OAuth, and authentication belong in later phases.
