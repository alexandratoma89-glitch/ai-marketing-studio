# Free tarot email flow

Public route: `/tarot-gratuit`. The existing marketing dashboard at `/` is preserved.

## Development preview

Run `npm ci` and `npm run dev`, then open `/tarot-gratuit` through port 3000's development preview. For a different origin, set `TAROT_SITE_URL` to its exact origin (no trailing path); the API checks Origin. `.env.example` documents variable names only. No credentials are needed for development.

Development uses an explicitly labeled deterministic Romanian sample interpretation for the randomly drawn card, an in-memory store, a development-only bot token and a private mock email outbox. It does **not** invoke AI APIs or send mail. The deck selection uses `node:crypto.randomInt` across 78 locally illustrated RWS cards. The generator receives no contact information. No card result, email address, consent token, or request ID is returned by the signup API. The success response is always `{accepted:true}` for both accepted and duplicate requests.

Mock messages are JSON files in the OS temporary directory, `arcana-private-outbox`, mode 0600 under a 0700 directory. They are never exposed through an HTTP route or logged. Use only test addresses in development. Memory resets on process restart; mock files remain until removed. Delete mock outbox files when finished. The browser never stores visitor PII in localStorage, URL parameters, or public pages.

## Production is deliberately inactive

The source-level `LIVE_EMAIL_AUTHORIZED=false` safety lock in `lib/tarot/providers.ts` prevents real sending even with credentials. Production signup fails with HTTP 503 while locked; it does not collect contacts or silently simulate real delivery. Never set `NODE_ENV=development` on a production deployment. Changing a single environment flag cannot unlock sending. Obtain explicit sending authorization before reviewing and changing this source lock, and obtain authorization for paid AI calls as well.

Required before a real launch:

1. Apply `supabase/migrations/202610160001_free_tarot.sql` to the intended Supabase project. Keep the service role key server-only. Browser roles have no table or RPC access. No live database has been migrated by this task.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TAROT_IP_HASH_SECRET` (a cryptographically random, long-lived secret), and HTTPS `TAROT_SITE_URL` to the canonical public origin.
3. Configure production Cloudflare Turnstile hostname and site/secret keys. The server verifies success, hostname and the `free_tarot` action. No bypass or Cloudflare test key is permitted in production. Protect the endpoint with hosting WAF request limits too, including requests that fail bot verification.
4. Configure the AI provider key `AI_API_KEY`, selected model `TAROT_AI_MODEL`, and Resend's `RESEND_API_KEY`, verified `TAROT_EMAIL_FROM` domain (SPF/DKIM/DMARC). No AI or email API was called during implementation.
5. Register `/api/tarot/webhook` in Resend for `email.delivered` and `email.bounced`, setting `RESEND_WEBHOOK_SECRET`. Signatures, five-minute timestamp tolerance and persistent event IDs prevent forged/replayed updates. Provider acceptance is stored as `provider_accepted`, not delivery. Bounce wins over late delivery notifications. Pre-receipt webhooks are retained and applied when the provider ID arrives.
6. Complete the published privacy notice with controller identity, contact, legal basis for the requested service, retention periods, rights procedure, processors and transfer details. Define and operate retention/deletion jobs and support procedures before real collection. Only then set `TAROT_PRIVACY_READY=true`. Do not put customer data in application logs or error tracking.
7. Set the optional HTTPS booking and subscription destination links. The offer is one 30-minute reading for **49 USD**; the independent daily-card subscription is **30 days free, then 10 USD/month**. These informational routes clearly state unavailability until configured. No payment, free trial, or recurring charge is activated here; checkout must disclose recurring terms and cancellation before purchase.
8. Verify all of the above on staging, explicitly authorize real sending, remove the reviewed source lock, and test actual mail with an approved test recipient. This deployment integration assumes Vercel's platform-overwritten `x-vercel-forwarded-for`; other hosts require a separately reviewed trusted-client-address adapter. Never trust arbitrary `X-Forwarded-For`.

## Consent and campaign boundaries

Email delivery of the requested reading is separate from marketing. The checkbox is optional, initially unchecked; both true and false choices are stored separately with timestamp, purpose and policy version. Duplicate requests do not alter consent. Selected marketing consent alone is not enough: the reading email contains a one-time-address-verification link, valid for confirmation for 48 hours. GET never changes consent. A visitor must press a button to POST confirmation. A withdrawal button is available via the same bearer link even after confirmation expiry; withdrawal cannot be undone using that token.

Tokens are 256-bit random values; only SHA-256 hashes are stored. Email links use URL fragments, which are removed from browser history on load and not sent in HTTP URLs/referrers. Consent pages use no third-party scripts. `tarot_campaign_eligible` is restricted to the server and selects only current, confirmed, unwithdrawn opt-ins. No other legal basis is inferred; no campaign provider is connected. Every future promotional campaign must recheck this view at send time, handle suppression/bounces and add a working unsubscribe link. Offers are shown on the thank-you page; the transactional reading email has no promotional offers for unconfirmed subscribers.

## Abuse controls and failure semantics

The Supabase RPC atomically admits requests with transaction-level locking: five submissions per trusted IP/hour, one normalized email per rolling 24 hours, and 200 readings globally per rolling 24 hours. Duplicates consume the IP quota and return an indistinguishable success response. Network addresses are HMAC pseudonyms. Rate-bucket rows are cleaned after two hours; other retention must be configured by the operator. Caps are conservative starting values, not a substitute for provider spending caps and hosting WAF rules.

The endpoint enforces same-origin JSON POST, an 8 KiB streamed body limit, a honeypot, name/email validation, policy version, strict consent booleans, Turnstile and server-side limits. Card and consent choices come from the validated request; clients cannot choose a card or inject a prompt. HTML is escaped, image and consent URLs use the configured origin, and no HTML from the model is accepted.

The request and consent record are committed before generation. Generation failure and email failure are stored distinctly; errors omit provider responses and PII. Email calls have a request-specific provider idempotency key. No automatic retries are made, including after timeouts, to avoid duplicates. An interruption may leave `requested`, `generating` or `generated` records; these need operator reconciliation against the provider before any manually authorized retry. There is no background queue or automatic campaign sender in this phase. Generation/email processing has bounded timeouts and a 60-second route duration.

## Validation

- `npm test`: original workflow tests, tarot unit/integration tests, and the actual SQL migration exercised against PGlite (embedded Postgres). Tests cover consent, privacy boundaries, all illustrations, failure statuses, duplicate and IP controls, provider safety lock, webhook signatures, RLS/permissions, and email event ordering. This does not establish connectivity to your Supabase project.
- `npm run test:e2e`: Chromium checks required/invalid input, unchecked consent, opt-in signup, mobile layout, mock email output, private confirmation, HTTP abuse controls and preservation of the dashboard. Uses a local server on port 3100. Install Playwright Chromium if a system browser is unavailable (`npx playwright install chromium`).
- `npm run build` and `npm run typecheck`: production compilation and TypeScript checks. Production runtime checks must confirm HTTP 503 while sending remains locked.
