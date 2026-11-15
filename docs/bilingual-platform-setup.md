# Bilingual platform: development review and setup

The development branch is `feature/divine-works-bilingual-platform`. Production has not been deployed. The existing domain remains `https://www.thedivinework.com`; no DNS change is needed.

## Implemented

- Original responsive EN/RO website, remembered language, browser-language routing, canonical URLs, hreflang, localized sitemap and social image.
- 78 bilingual educational card guides using the existing locally stored public-domain Rider–Waite–Smith illustrations. Attribution: `public/tarot/ATTRIBUTION.md`. Original interpretations; no reference-site content or imagery copied.
- Random free draw, same-card email request, separate unchecked promotional consent and existing confirmation/withdrawal flow. Development email delivery remains simulated.
- Customer email/password and Google sign-in integration, password recovery, language/profile settings and account deletion.
- Private journal create/read/update/delete, search/date history, personal card notes and studied-card progress. Real database ownership policies are tested with two users. Customer identity is separate from Studio Basic authentication.
- Existing booking, first-eligible-booking discount, membership, welcome offer, management links and cancellation adapted for both languages. Exact RON amounts and existing source-level payment/mail locks remain.
- Existing social publishing, cron, uploads, credentials, approval requirements and stored posts are preserved.

## Review before production

1. Review the development design and test results.
2. Test a preview with a dedicated test Supabase project and test credentials. Do not connect a preview to production account data by default.
3. Approve production deployment only after auth, email and database checks below are complete.

The external reference site could not be inspected from this environment (network access returned CONNECT 403). The design is original and follows the supplied written brief.

## Database: additive migrations

Back up the database first. Apply existing migrations 001–013 in order if preparing a new test project, then:

- `supabase/migrations/202611150014_private_tarot_journal.sql`
- `supabase/migrations/202611150015_commerce_locale.sql`

014 adds only customer profile/journal/card-note tables and owner-level RLS. It requires Supabase's existing `auth.users` and `auth.uid()`.
015 adds an order language field (existing records default to Romanian) and wraps the existing commerce command without changing prices or webhook processing.

Verify in a test project that two signed-in users cannot read, update or delete each other's rows. Verify that deleting a customer removes only that customer's journal. Do not disable RLS. For rollback, turn off the feature flags and restore the previous application deployment; keep the additive tables and records until a separately reviewed data rollback is needed.

## Vercel environment settings

Use these exact **Key / Value** pairs in the preview environment first:

| Key | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | The test Supabase project's HTTPS URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The same project's public anon key; never the service-role key |
| `JOURNAL_DATABASE_READY` | `true`, only after migration 014 and Auth configuration |
| `PUBLIC_PLATFORM_DATABASE_READY` | `true`, only after migration 015 |

Account deletion also needs the existing server-only `SUPABASE_SERVICE_ROLE_KEY` for the **same project**. Never expose that key in a `NEXT_PUBLIC_` setting. The journal itself uses the signed-in user's JWT and public anon key, with RLS.

Leave all existing Studio, social publishing, Stripe, Brevo and encryption keys unchanged. Do not replace `STUDIO_USERNAME` or `STUDIO_PASSWORD`; those are owner access only.

## Supabase Authentication

**Action:** Supabase dashboard → Authentication → URL configuration.

- **Site URL:** `https://www.thedivinework.com` for production; the exact preview origin for a test project.
- **Redirect URL:** `https://www.thedivinework.com/api/account/callback`.
- Add the exact test preview callback and `http://localhost:3100/api/account/callback` only to the test project's allowlist.
- Keep email confirmation enabled. Set a password policy of at least 12 characters.
- Configure a verified SMTP sender and test signup confirmation and password reset. Default limited development mail is insufficient for production.
- Translate Supabase signup/recovery templates using the customer's `.Data.locale`; retain the provider's `.ConfirmationURL`. The app stores locale in user metadata and profile. Never substitute a raw user-provided redirect URL in an email template.

**Action:** Authentication → Sign-in providers → Google.

Create a **separate Google OAuth web client for Supabase customer authentication**. Use the exact callback shown by Supabase (normally `https://PROJECT.supabase.co/auth/v1/callback`). Add authorized test users while the Google app is in Testing. Configure its client ID and secret in the Supabase provider settings.

**Do not overwrite the website's existing `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET`: those support the working YouTube publishing integration.**

Test email signup → confirmation → login, Google login, logout, password reset, language persistence, and deletion with two real test customers before production approval. Local browser tests exercise the journal interface using a mocked account; SQL tests exercise actual ownership policies. They do not prove live Google/SMTP configuration.

## Booking, membership and emails

Current source-level locks for live Stripe commerce and customer delivery remain disabled. Existing Stripe sandbox and mock email tests continue to run. Do not promise live booking payments, daily paid email delivery or inbox delivery based on the redesign alone.

Before live commerce, the existing business identity, VAT status, merchant terms, refund/cancellation policy, sender verification and payment/email activation review must be completed. The welcome offer retains its separate existing authorization gate; newsletter consent is never inferred from requesting it or from creating a journal account.

The public privacy text should be reviewed with the actual legal operator, contact address, retention policy and processors before launch. Set the existing `BUSINESS_OPERATOR_NAME` and `BUSINESS_CONTACT_EMAIL` only to verified owner-provided details.

## Preserved owner publishing

`/studio` and `/api/studio` retain their existing Basic authentication. Existing Instagram accounts, Facebook Page, YouTube channel, cron secret, encrypted tokens, approval checks and uncertain-result protections are unchanged. This development branch does not send or schedule new public posts.
