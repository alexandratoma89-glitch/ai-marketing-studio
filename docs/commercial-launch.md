# The Divine Work: commercial launch preparation

This release implements a **test-only** commerce flow without changing the existing black/purple customer design. It does not turn on live charges, customer emails, paid AI calls, a new paid plan, or external scheduling. The latest owner instruction supersedes earlier live-email authorization. Both live email and live commerce have source-level locks in `lib/commerce/safety.ts`; live Stripe keys and events are rejected. Setting environment flags cannot enable live transactions. The existing `/studio` browser-password protection also covers `/studio/bookings`, `/studio/launch`, and `/api/studio/*`.

## Status

| Capability | Implemented and tested | External state |
|---|---|---|
| Brevo | Transactional payload adapter, mock outbox, authenticated delivery events and logs; free/booking/membership emails share the delivery boundary | No Brevo account/API delivery verified. No real email sent. |
| Secure contacts | Supabase/Postgres tables, server-only RPC, RLS, separate optional unchecked consent, timestamp/purpose/policy version, confirmation and withdrawal | SQL tested in embedded Postgres; not applied to a live Supabase project |
| Booking | Owner publishes actual UTC slots, 30-minute duration, overlap validation, audio/video selection, private joining link, transactional slot reservation | No real availability published by this task. Host must supply dates and meeting links. No Google/Zoom calendar integration is implied. |
| Stripe Checkout | $49 USD; $44.10 for first eligible booking per normalized email; membership $10/month, first trial 30 days; server-owned pricing | SDK requests tested against mocks. No external Stripe sandbox transaction verified; test credentials required |
| Stripe webhooks | SDK signature verification, test-mode check, event dedupe, booking/payment validation, current subscription retrieval, event ordering | Configure webhook endpoint/version in Stripe sandbox |
| Cancellation | Future booking cancellation requests a full test refund; refund status comes from webhook. Membership cancellation stops renewal at period end | Test policy only. Real legal cancellation/refund terms must be agreed before live service |
| Daily delivery | Trialing/active, unexpired memberships; one reading per member per Europe/Bucharest calendar day after 08:00; claimed queue, mock delivery, suppression, failure logs | External scheduler required; no automatic scheduler was activated. Interpretations remain Romanian demo readings, not paid AI output |
| Account management | Expiring HMAC-signed private links, fragments removed from history, generic email-based link recovery, no customer email in public URLs/responses | Management messages are in the private mock outbox until email activation is separately authorized |
| Studio | Existing authentication retained; owner slot management and delivery/status logs | Vercel owner username/password must remain configured |

## 1. Accounts and business details you configure personally

- **Namecheap Private Email:** create and test the mailbox (e.g. `contact@thedivinework.com`). Never give mailbox credentials to this application. Confirm trial/renewal terms separately.
- **Brevo:** create an account, verify your business, authenticate the intended sending domain, create a transactional API key, and select sender/reply-to addresses. A dedicated sending subdomain can keep the Namecheap inbox configuration separate. Do not upload contacts to promotional lists by default.
- **Supabase:** create a dedicated EU-region **test project**. Apply `202610160001_free_tarot.sql` and then `202610160002_commerce.sql` once, in order, using Supabase migrations/SQL editor. The second migration is additive and updates shared consent eligibility; do not rerun migrations against an existing populated schema blindly. Set server-only URL/service-role credentials. No anon/browser key grants access to these tables.
- **Stripe:** create the account for your Romanian business, accurately describe tarot guidance, and confirm Stripe's acceptance of the business and supported payment setup. Complete identity/bank/business verification personally. Create a Stripe sandbox/test secret key, never a live one. Confirm the Romanian entity's invoicing/tax responsibilities with your adviser; USD is retained from the requested pricing.
- **Cloudflare Turnstile:** register the site keys for `www.thedivinework.com` (and approved test hostname). Required on hosted deployments; development-only bypass never runs in production.
- **Meeting provider:** supply an HTTPS audio/video participation link for each slot. Selecting audio requests camera-off participation; the app does not provision Zoom/Meet rooms or recordings. Keep other calendar commitments reflected in the published slots.
- **Scheduler:** configure authenticated calls to the delivery worker every 5–10 minutes. Vercel Cron frequency depends on plan; choose a supported plan or external scheduler. No paid scheduler was enabled by this task.
- **Business/legal information:** legal name/entity, Romanian registration/tax details, postal/contact address, support email, VAT/invoice handling, intended customer age policy, cancellation/no-show/refund rules, consumer withdrawal handling for early service delivery, privacy controller, processor/transfer disclosures, retention/deletion procedures. `/termeni` and privacy pages are test drafts, not final commercial terms.

## 2. Environment settings (Vercel, server-side)

Use a separate Preview/test environment and test database where possible. The site may display test flows on Production, but only use synthetic contacts and Stripe test cards there. Never publish secret values in Git, chat, screenshots, client props, or logs.

| Name | Purpose |
|---|---|
| `TAROT_SITE_URL` | Canonical HTTPS origin, normally `https://www.thedivinework.com`; exact same-origin requests are enforced |
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Test project connection; service-role key is server-only |
| `TAROT_DATABASE_READY=true`, `COMMERCE_DATABASE_READY=true` | Operator confirmations that the respective migrations were applied successfully |
| `TAROT_EMAIL_MODE=mock` | Required test-only email mode; no Brevo customer delivery |
| `TAROT_PRIVACY_READY` | Set true only after the notice is completed for any real personal-data collection; otherwise use synthetic data locally |
| `TAROT_IP_HASH_SECRET` | Random 32+ character secret for pseudonymized IP rate buckets |
| `TURNSTILE_SECRET_KEY`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Server secret and public site key for bot protection |
| `COMMERCE_MODE=test` | Enables native booking/membership test routes. `live` is unsupported |
| `STRIPE_SECRET_KEY` | `sk_test_...` only; no publishable key is needed for hosted Checkout |
| `STRIPE_WEBHOOK_SECRET` | Sandbox endpoint signing secret `whsec_...` |
| `COMMERCE_TOKEN_SECRET` | Independent random 32+ character signing key for private management and marketing links |
| `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_REPLY_TO` | Future verified Brevo connection; mock mode intentionally does not use the key |
| `BREVO_WEBHOOK_SECRET` | Independent random 32+ character token configured as Bearer auth on the Brevo webhook |
| `CRON_SECRET` | Independent random 32+ character Bearer secret for scheduler |
| `COMMERCE_JOBS_ENABLED=true` | Enables authenticated test delivery/reconciliation calls |
| `STUDIO_USERNAME`, `STUDIO_PASSWORD` | Preserve existing owner login, password at least 24 characters |

No `STRIPE_PUBLISHABLE_KEY` is needed because the browser redirects to hosted Checkout. No live key is accepted. No paid AI key is required for mock Romanian readings. Retired Resend variables and external `TAROT_BOOKING_URL`/`TAROT_SUBSCRIPTION_URL` flags are no longer used by the new native flow.

## 3. DNS records: copy exact values from Brevo

Keep the working Vercel `@` A record and `www` CNAME. Keep all existing Namecheap Private Email MX/DKIM/SPF records. In Brevo's domain authentication screen, copy the exact domain-verification, DKIM and DMARC records it requires for your chosen domain/subdomain into Namecheap Advanced DNS. Providers change selectors/values; this project intentionally does not invent DNS values. Avoid duplicate SPF or DMARC records at the same hostname. A DMARC policy should be aligned with both sending services before enforcement. Do not switch nameservers or replace mailbox MX records to enable transactional sending.

## 4. Stripe webhook setup

Use sandbox/test endpoint `https://www.thedivinework.com/api/commerce/webhook`, matching the origin being tested. The installed Stripe Node SDK is 23.x, API **2026-09-30.endive**; configure the endpoint version accordingly. Subscribe to:

- `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`
- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `invoice.paid`, `invoice.payment_failed`, `charge.refunded`

Copy the sandbox signing secret to `STRIPE_WEBHOOK_SECRET`. Requests require valid raw-body signatures. Live events are rejected. Do not treat `/rezervare/status`, a URL parameter, or a client redirect as payment proof. Subscription events retrieve the current test subscription to resist stale event delivery. Events that arrive before checkout has been recorded fail for provider retry instead of being discarded.

## 5. Brevo webhook and queue setup

Configure `https://www.thedivinework.com/api/integrations/brevo` for transactional delivered/bounce/block/invalid/spam events, with custom Bearer authorization using `BREVO_WEBHOOK_SECRET`. The route authenticates the shared secret over HTTPS, validates bounded input and deduplicates events; it does not claim Brevo provides a Stripe-style cryptographic signature. If your Brevo webhook settings cannot provide the required authenticated header, keep it disabled until a supported authenticated integration is configured. Never put the token in a public query string. No Brevo webhook was registered by this task.

Schedule `GET /api/jobs/deliveries` with `Authorization: Bearer <CRON_SECRET>`. Run frequently enough for the intended volume (at most 10 jobs per call). The worker enqueues a daily reading once per member per Romanian date after 08:00, using current stored Stripe eligibility. It also reconciles checkout holds only after Stripe reports expiration. Claimed jobs are exclusive and completed messages do not resend. Delivery acceptance differs from actual delivery; authenticated provider events update final status. Bounce wins over late delivery.

Do not automatically retry uncertain sends or jobs stranded in `processing`: reconcile with the provider first. Failure logs contain codes rather than contact data or provider secrets. The `/studio/bookings` screen shows recent statuses and owner availability. Mock messages contain private management tokens/PII in an OS-temporary 0700 outbox directory with 0600 files, never served by HTTP. Delete test artifacts after testing.

## 6. Acceptance checks before any future activation

1. Publish test slots from `/studio/bookings` with explicit ISO timezone offsets. Verify Romania DST display and audio/video availability. Overlaps must fail.
2. Use Stripe test cards only. Complete the first $44.10 booking; try another concurrent booking for the same slot; verify only one succeeds. A returning normalized email should be charged $49. An alternative email is treated as a distinct customer; this is not identity verification.
3. Replay Stripe webhook events, change event order, and try a forged signature and live event; no duplicate fulfillment or unauthorized confirmation should occur.
4. Check mock booking confirmation contains the correct time, mode, private joining URL and management link. Confirm optional marketing is unchecked and no campaign eligibility exists without separate confirmation. Test withdrawal.
5. Cancel a future test booking, verify refund-pending and then refunded from the Stripe refund event. No actual money moves. The current test rule is a full refund for future appointments, not a finalized live policy.
6. Start the membership trial, verify 30 days and $10 USD/month in Checkout. Returning members do not receive another trial. Test trial end/payment failure/cancellation via Stripe test clocks where available. Confirm eligible daily readings are once-only and canceled/expired/unpaid members are excluded.
7. Test private-link expiry, requesting a new link, cancellation at period end and retention of access until the recorded paid/trial period ends. No email is returned in public responses or URLs.
8. Confirm `/studio`, nested studio routes and studio APIs reject anonymous access. Review business terms/privacy, provider acceptance, DNS verification, support procedures and retention/deletion policy.
9. Only after explicit future owner authorization, remove the reviewed live locks, configure live provider adapters/keys separately, and perform approved live validation. This step is **not performed** by this release.

## Automated tests actually run

`npm test` exercises actual SQL migrations in embedded Postgres (PGlite), service transitions, server prices, slot locking, discount/trial controls, raw Stripe SDK signature validation, simulated Checkout/subscription/refund adapters, Brevo serialization and send locks, consent verification, failure logs, deduplication and delivery ordering. `npm run test:e2e` uses Chromium against the real Next.js local server for public forms, mobile layouts, owner slot publishing, audio/video, terms/consent, management privacy and studio access. `npm run build`/`npm run typecheck` validate production compilation. These tests do not establish connection to external Supabase, Brevo or Stripe accounts.
