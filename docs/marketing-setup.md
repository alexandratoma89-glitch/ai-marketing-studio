# Marketing setup — owner checklist

This feature syncs **confirmed, current marketing opt-ins** to a dedicated Brevo list. Free readings, welcome-offer requests and account creation alone do not subscribe anyone. Existing confirmed opt-ins are backfilled. Withdrawals, provider blacklists, complaints and permanent bounces are excluded. The existing free-reading API key and Supabase SMTP configuration stay unchanged.

## 1. Database

In Supabase → SQL Editor → New query, paste the complete contents of `supabase/migrations/202611160016_marketing.sql`, then Run **once**. Requires existing migrations 001 and 002 (already part of the current site). Do not rerun old migrations. This migration adds private marketing sync/lease/draft tables and a service-role-only RPC; it does not modify purchase availability or send mail.

## 2. Dedicated list

Brevo → CRM → Contacts → Lists → Create list.

- Name / Value: **Divine Works — confirmed website subscribers**
- Start with an **empty** list; do not import other addresses into it.
- Copy its numeric list ID (shown in the list page/URL).

## 3. Separate API key

[Brevo API keys](https://app.brevo.com/settings/keys/api) → Generate API key.

- Name / Value: **Divine Works Marketing**
- Permission **Contacts → All**
- Permission **Email campaigns → All**
- Other permissions: **None**

Copy the generated value directly to Vercel. Do not paste it in chat. Keep the existing free-reading key and SMTP keys unchanged.

## 4. Vercel variables

Project **ai-marketing-studio** → Settings → Environment Variables. Environment: **Production** for every row.

| Key | Value | Type |
| --- | --- | --- |
| `MARKETING_DATABASE_READY` | `true`, after SQL succeeds | Config |
| `BREVO_MARKETING_API_KEY` | Actual new Brevo **API** key | Secret |
| `BREVO_MARKETING_LIST_ID` | Numeric ID of the dedicated empty list | Config |
| `BREVO_MARKETING_WEBHOOK_SECRET` | New random token, at least 32 characters | Secret |
| `BREVO_MARKETING_ENABLED` | `true`, after completing this checklist | Config |

Generate the webhook token locally with `openssl rand -hex 32`; copy the **same resulting value** into Vercel and the Brevo webhook below. Save it securely because Vercel cannot reveal Secret values later.

Already configured and reused: `BREVO_SENDER_EMAIL`, `BUSINESS_OPERATOR_NAME`, `BUSINESS_CONTACT_EMAIL`, and `CRON_SECRET` (at least 32 characters). No need to replace them. Set the marketing enable flag last, then redeploy Production so the new variables apply.

## 5. Marketing webhook

Brevo → Webhooks → Add webhook → **Outbound**.

- URL / Value: `https://www.thedivinework.com/api/integrations/brevo/marketing`
- Authentication method / Value: **Token**
- Token / Value: the exact value saved as `BREVO_MARKETING_WEBHOOK_SECRET` (Brevo adds `Bearer`; do not type it twice)
- Event category / Value: **Marketing email**
- Events: **Unsubscribed**, **Spam/complaint**, **Hard bounce**, **Invalid**, **Blocked**, where available in this category.
- Activate webhook.

Keep the existing Transactional email webhook unchanged. Marketing event names are normalized; irrelevant opens/clicks/delivery events are ignored. The authenticated marketing endpoint stores suppressions idempotently. A provider unsubscribe is never automatically reversed, even if an old consent link is clicked again.

## 6. Verify and prepare a campaign

Open `https://www.thedivinework.com/studio/marketing` and sign in with the existing private Studio username/password.

1. Every configuration check should show ✓. These checks indicate configuration presence, not provider permission acceptance.
2. Click **Sincronizează acum**. Check that errors are 0 and pending changes reach 0. After completing [the external scheduler setup](free-scheduler-setup.md), automatic synchronization runs roughly every five minutes, processing up to three changes per run, removals first. Repeat manual sync for a larger backlog. Failed/uncertain changes stay queued; no addresses appear in the UI/logs.
3. Confirm using one owned test address: submit the free-reading form with optional marketing consent, follow its confirmation link, sync and verify list membership in Brevo. An unconfirmed or unchecked address must stay out.
4. Withdraw consent using the original email link; sync and verify removal. Repeated webhook deliveries are safe. A Brevo unsubscribe blocks the address immediately within Brevo and queues local list removal.
5. Write a subject and message in Studio. Preview the text. **Creează ciornă în Brevo** creates a draft only, with no schedule or send call. The remote list is checked against eligible synced addresses before draft creation. The draft includes operator/contact details, privacy links and Brevo's unsubscribe link.
6. Brevo → Marketing → Campaigns → find **Divine Works [reference]**. Review recipients, sender, subject, content and the footer. Add the business postal address if Brevo requires it. Send a test to yourself. Select **Send** or schedule **in Brevo** only when approved. Before final sending, sync again and verify recipients; do not add unconfirmed contacts or replace the dedicated recipient list.

Campaigns target the dedicated list as a whole; no automatic language segmentation, promotions or recurring broadcasts are configured. Write bilingual content if both language audiences are included, or review/filter the intended audience in Brevo. Existing unsubscribe controls continue to apply.

If creation is uncertain, Studio stores the immutable reference and refuses to repeat the same request. A crash can leave it marked `creating`; **search for that reference in Brevo before making a new draft**. This avoids duplicate campaigns after a lost response. Sync API writes are repeatable; ambiguous writes remain queued until reconciled.

## Verification limits

Local tests cover consent filtering, withdrawal/suppression, uncertain writes, single-worker leasing, draft deduplication, browser access control and the draft-only UI. Actual remote list membership, webhook delivery and inbox delivery require the owner's authenticated Brevo/Vercel/Supabase setup. No real campaign is sent during implementation tests.
