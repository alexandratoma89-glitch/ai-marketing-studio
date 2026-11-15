# Connect the free website: Vercel + Supabase + Brevo

The owner authorized launch of the free website, accounts and requested emails on 2026-11-15. Purchases, paid bookings and paid membership remain unavailable. This guide does not enable them.

There is no direct Vercel/Supabase/Brevo connector in this chat. Use the dashboards below. Secret values stay in the dashboards; screenshots shared in chat should show names/status only.

## 1. Open the existing projects

- Vercel: https://vercel.com/starpower/ai-marketing-studio/settings/environment-variables → select **Production**.
- Supabase: https://supabase.com/dashboard → open the **existing project used by Studio and the own-videos bucket**.
- Brevo: https://app.brevo.com → use the existing sending account.

Keep the working Studio/social credentials. There is no need to create a new Studio password, replace YouTube credentials, buy another domain or create another website project.

## 2. Prepare the database

In Supabase, verify a current backup exists, then open **SQL Editor → New query**. Run these files in order:

1. `supabase/migrations/202611150014_private_tarot_journal.sql`
2. `supabase/migrations/202611150015_commerce_locale.sql`

These add private customer journal tables and a language field for existing order handling. They do not activate purchases or modify published social posts. If a file reports an existing table/function, stop and verify whether that migration was already applied instead of dropping objects.

## 3. Connect customer accounts in Vercel

In the same Supabase project, find **Project settings → Data API / API keys**. Copy the Project URL and the **public anon key**. The Project URL must end at `.supabase.co` (for example, `https://PROJECT.supabase.co`), without `/rest/v1` or `/auth/v1`. Do not use the service-role key for a public setting.

In Vercel → Settings → Environment Variables → Production:

| Key | Value | Action |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL from the existing Supabase project | Add if missing |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key from the same project | Add if missing |
| `JOURNAL_DATABASE_READY` | `true` | Set after migration 014 succeeds |
| `PUBLIC_PLATFORM_DATABASE_READY` | `true` | Set after migration 015 succeeds |

The existing `SUPABASE_URL` and server-only `SUPABASE_SERVICE_ROLE_KEY` must belong to that same project. Keep their existing values. The readiness flags above cannot enable purchases; the public checkout routes are explicitly closed in code.

## 4. Set Supabase account URLs

Supabase → Authentication → URL Configuration:

| Field | Value |
| --- | --- |
| Site URL | `https://www.thedivinework.com` |
| Redirect URL | `https://www.thedivinework.com/api/account/callback` |
| Redirect URL for callback query parameters | `https://www.thedivinework.com/api/account/callback?**` |

Keep email confirmation enabled and set the minimum password length to 6. The application validates callback destinations and accepts only account/journal destinations on this website.

For Google sign-in, create a separate Google Cloud OAuth **Web application** client for Supabase Auth. Copy the callback URL shown by Supabase into that client's authorized redirect URLs. Enter the new client ID/secret in **Supabase → Authentication → Sign-in providers → Google**. This is separate from the working YouTube client; do not replace the website's existing `GOOGLE_CLIENT_ID` or `GOOGLE_CLIENT_SECRET`.

## 5. Verify the Brevo sender

Brevo → Settings → Senders, domains & dedicated IPs:

1. Add/verify the sender address you will actually use.
2. Authenticate `thedivinework.com` using the DNS records Brevo supplies. Add those exact records at the domain's DNS provider.
3. Wait until Brevo reports the domain authenticated and sender active.

In Vercel, reuse existing working values where present:

| Key | Value |
| --- | --- |
| `BREVO_API_KEY` | Your Brevo transactional API key; reuse the existing key if configured |
| `BREVO_SENDER_EMAIL` | The verified sender email address |
| `BREVO_REPLY_TO` | Your monitored reply-to email address |
| `BUSINESS_OPERATOR_NAME` | The actual operator name used in the privacy information |
| `BUSINESS_CONTACT_EMAIL` | Your real contact email address |
| `BREVO_WEBHOOK_SECRET` | Existing webhook secret, or a new random value of at least 32 characters if absent |

To generate a missing webhook secret on your own terminal, run `openssl rand -hex 32` and copy the output into the setting. Keep the value private.

Brevo transactional webhook:

- **URL:** `https://www.thedivinework.com/api/integrations/brevo`
- **Events:** delivered, hard bounce, soft bounce, blocked, invalid, spam.
- **Authorization header:** `Bearer ` followed by the exact `BREVO_WEBHOOK_SECRET` value.

The website records provider acceptance separately from actual delivery. A lost send response is not automatically retried.

## 6. Connect Supabase password/signup emails to Brevo SMTP

Brevo → SMTP & API → SMTP: obtain the **SMTP login and SMTP key**. The SMTP key is different from the transactional API key.

Supabase → Authentication → Email / SMTP settings:

| Field | Value |
| --- | --- |
| Host | `smtp-relay.brevo.com` |
| Port | `587` |
| Username | The SMTP login shown by Brevo |
| Password | The SMTP key shown by Brevo |
| Sender email | The verified Brevo sender address |
| Sender name | `Divine Works` |

In Supabase email templates:

- **Confirm signup → body:** copy `supabase/templates/confirmation.html`.
- **Reset password → body:** copy `supabase/templates/recovery.html`.
- **Subject:** `Divine Works` is a language-neutral subject for both templates; the body selects English/Romanian from the account language.

The templates use the verified token hash, so a reader can open a confirmation/reset email on a different browser or iPhone. Do not substitute the six-digit token for `TokenHash`.

## 7. Enable requested free-reading emails only

After database, sender/domain, privacy information, webhook and Turnstile are verified, set in Vercel Production:

| Key | Value |
| --- | --- |
| `TAROT_DATABASE_READY` | `true` (existing free-reading migration must already be installed) |
| `TAROT_PRIVACY_READY` | `true` after the actual privacy information is complete |
| `TAROT_EMAIL_MODE` | `live` |
| `FREE_READING_EMAIL_ENABLED` | `true` |
| `FREE_READING_SENDER_VERIFIED` | `true` |

Retain the existing valid `TAROT_SITE_URL`, `TAROT_IP_HASH_SECRET`, `TURNSTILE_SECRET_KEY` and `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. Turnstile must accept `www.thedivinework.com`.

This enables **requested free card reading emails only**. Marketing remains an unchecked, separate opt-in with its own confirmation/withdrawal. This does not send marketing campaigns or activate daily paid membership mail. Requests are limited to one free reading per email address per 24 hours.

## 8. Publish and verify

The code is on `feature/divine-works-bilingual-platform`. Saving environment variables alone does not publish that branch. After configuration is complete, publish the tested branch to the existing production project and domain.

Test using email addresses/accounts you control:

1. Both EN and RO pages show the purchase-unavailable notice.
2. Free draw and all 78 guides work on iPhone and desktop.
3. A free reading arrives with the same drawn card and correct language.
4. Unchecked marketing consent does not subscribe the reader. Checked consent needs confirmation; withdrawal works.
5. Signup confirmation, Google sign-in, password reset, journal save/reload/edit/delete, language preference and account deletion work.
6. Two customers cannot read each other's journal entries.
7. Neither public checkout route accepts purchases, even if old Stripe test settings exist.
8. Existing Studio sign-in and social publishing still work.

`npm run check:free-launch` performs read-only configuration/connectivity checks when run with the appropriate environment settings. It prints setting names/status, never secret values. It does not replace checking real received emails and customer authentication.

## Troubleshooting free email and Google login

- A Google login URL containing `/rest/v1/auth/v1/authorize` means a Data API URL was entered in `NEXT_PUBLIC_SUPABASE_URL`. Use the project base URL without `/rest/v1`. Auth now normalizes the commonly copied API paths; the actual OAuth path must be `/auth/v1/authorize`.
- A free request with `email_failed` was saved but has no confirmed delivery. This is not a purchase restriction. Do not delete requests or repeatedly resend uncertain deliveries.
- The owner can open `/api/studio/free-email-check` with existing Studio authentication for a read-only check. It sends no emails and returns only readiness flags and sanitized provider results.
- `api_key_rejected`: check the Vercel Brevo API key, which is separate from the SMTP password.
- `ip_approval_required`: inspect Brevo's authorized-IP controls for the actual hosting requests.
- `provider_access_denied` or `transactionalEnabled: false`: check Brevo account permissions/transactional activation.
- `senderActive: false`: verify the sender address matches the active verified sender in Brevo.
- Provider rejections are logged as `free_reading_delivery_rejected` with HTTP status and a sanitized reason. Raw API responses, keys and addresses are not logged by this diagnostic.
