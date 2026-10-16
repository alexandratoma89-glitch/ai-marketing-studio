# Free tarot reading flow

The existing public homepage and `/tarot-gratuit` use the same premium design. Required first name/email, optional unchecked marketing consent, random one-of-78 RWS card selection, complete Romanian reading email, and private thank-you confirmation are preserved. Images are served locally; contact details are never sent to an image host or the AI adapter.

The latest owner instruction keeps all customer email in test mode. Brevo replaces the planned Resend connection. `BrevoEmailProvider` serializes the complete HTML/text transactional reading, while mock mode writes to a private OS-temporary outbox and performs no customer sending. Source-level locks block real delivery even if API keys are present. Interpretations use the explicit Romanian sample generator during testing; no paid AI call is activated.

Development now uses embedded Postgres with the same migrations and server-only interface as the hosted Supabase test database. Local data resets on server restart. `MemoryStore` remains a unit-test fixture, not production storage. Hosted production/test requires Supabase connection, schema confirmations, privacy readiness and Turnstile; it never falls back to local storage or a development captcha token.

Signup responses contain only `{accepted:true}` for both accepted and duplicate requests. The reading and contact email never appear in the public response/thank-you page. Contacts and requests are committed before generation; errors store distinct preparation/send statuses. Rate controls remain five requests per IP/hour, one normalized email per rolling 24 hours, and a global 200/day cap. Requests have a streamed body limit, same-origin JSON restriction, strict name/email/consent/policy validation, honeypot and Turnstile on hosted deployments.

Marketing is independent of the requested reading. Both true and false choices are recorded with timestamp/purpose/policy version. A separate confirmation is required before eligibility. The shared Supabase view now considers free-reading and commerce consent records, takes the latest choice, and excludes withdrawn/unconfirmed contacts. Withdrawal applies across both sources. There is no automatic Brevo campaign-list upload.

Use `npm ci`, then `npm run dev`, and open `/tarot-gratuit` through the development port preview. Set `TAROT_SITE_URL` to the exact preview origin when different from the local default, as cross-origin submissions are rejected. Mock messages are never served over HTTP. Use only synthetic test contacts.

See [commercial launch configuration and provider checklist](commercial-launch.md) and `.env.example` for all accounts, DNS, variables, webhook endpoints and acceptance tests. Initial migration: `202610160001_free_tarot.sql`; commerce/shared consent extension: `202610160002_commerce.sql`. Both have been tested locally, not applied to an external project by this task.
