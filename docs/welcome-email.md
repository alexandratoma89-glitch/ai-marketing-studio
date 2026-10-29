# Welcome offer and business email

The homepage and `/tarot-gratuit` include a native-dialog popup and a persistent offer button. When the integration is ready, the popup appears after 12 seconds unless the visitor is typing, the tab is hidden, or the offer was recently dismissed. Dismissal is remembered locally for 7 days; successful requests for 90 days. `/bun-venit` is the standalone form for social links. `/studio/email` shows configuration checks without credential values.

## Mailbox versus automated sending

Namecheap Private Email hosts the business inbox. Brevo sends the explicitly requested welcome email. An active Namecheap email subscription does not itself establish a mailbox or a Brevo account.

1. Namecheap → Private Email → Manage → create or inspect the desired mailbox. Use its webmail to send a message to an address you control and reply to it. Do not share its password.
2. Preserve the domain's existing website DNS and MX records. Add the precise SPF/DKIM verification records shown by Namecheap and Brevo. Do not invent records, add multiple SPF records at the same name, or replace working Namecheap MX records with Brevo records. Check the DNS provider actually hosting the authoritative nameservers.
3. Brevo → Settings → Senders, Domains & Dedicated IPs. Verify the sender address using the Namecheap inbox and authenticate `thedivinework.com` with the records Brevo supplies. Add/validate DMARC as instructed by the provider. Brevo status must be verified; a local environment flag cannot establish that.
4. In Brevo, create an API key for transactional sending and put it only in Vercel as `BREVO_API_KEY` (Secret). Set `BREVO_SENDER_EMAIL` and `BREVO_REPLY_TO` to the agreed business mailbox. Do not copy SMTP passwords into the API-key field.

## Website configuration

Apply `supabase/migrations/202610290007_welcome_email.sql` in the existing Supabase project. The migration is independent of commerce migrations. Set Production variables:

- `WELCOME_DATABASE_READY=true`
- `WELCOME_SENDER_VERIFIED=true` only after the sender/domain are verified in Brevo
- `BUSINESS_OPERATOR_NAME` to the operator's accurate public identity, and `BUSINESS_CONTACT_EMAIL` to an inbox that handles privacy requests
- `WELCOME_PRIVACY_READY=true` after reviewing the updated privacy information
- `WELCOME_EMAIL_ENABLED=true` enables only user-requested welcome email
- `BREVO_API_KEY`, `BREVO_SENDER_EMAIL`, `BREVO_REPLY_TO`
- Existing `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TAROT_SITE_URL=https://www.thedivinework.com`, independent random `TAROT_IP_HASH_SECRET` at least 32 characters
- Cloudflare Turnstile `TURNSTILE_SECRET_KEY` and public `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; register the www hostname. The existing widget/verification action is `free_tarot` for compatibility.

Redeploy after environment changes. Check `/studio/email`, then make one explicit request from `/bun-venit` using the owner's email address. Check Brevo Transactional logs and the receiving inbox (including Spam). Provider acceptance is not proof of inbox delivery. There is no newsletter, contact-list synchronization, bulk campaign, or automatic follow-up.

## Offer and delivery behavior

10% is the existing first-eligible-private-booking discount: 179 lei → 161,10 lei for 30 minutes. The email is a reminder/link, not a fabricated coupon. The same email must be used at booking, and eligibility remains enforced by the existing checkout server. Checkout is still TEST-only, so the welcome email discloses that reservations may be in test mode. No live payment flag or other customer email flow is changed.

Only email, explicit request/policy version, timestamp, status, and HMAC network identifier are recorded. No subscription is inferred. Requests are deduplicated by normalized email for 30 days and limited to three per network identifier per hour. SQL locks make admission concurrent-safe. Records older than 90 days are removed on subsequent requests; this is not a scheduled purge. Use Supabase administrator tools to handle deletion/access requests; anonymous users cannot read rows or invoke the RPC.

The provider attempt is claimed once before sending. Timeouts, lost acknowledgements, or persistence failures become uncertain and are not retried automatically. A process interruption may leave `sending`; inspect Brevo logs before any manual recovery. Duplicate requests receive the same generic acceptance message without confirming registration or retrying. No provider response, key, raw email, or message content is logged.

In development, PGlite stores requests and the existing private mock outbox records email. UI explicitly says simulated. Production fails closed until every required setting is present.
