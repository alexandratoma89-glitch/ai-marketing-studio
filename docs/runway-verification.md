# Runway: one controlled video test

The owner has reported successful Runway authentication in the deployed Studio. This change adds real generation code; development verification still uses mocks only. No paid generation is started by setup, deployment, a connection check, a cron job or preparing a draft.

## Implemented workflow

`/studio/videos` is the persistent generated-video library; the old concept/demo library is preserved separately. Prepare one free draft containing an editable cinematic tarot visual prompt and separate Romanian marketing copy/disclosure. This first version supports exactly one lifetime test job, not daily production or repeated regenerations.

The fixed request uses Runway `POST /v1/text_to_video`, model `gen4.5`, duration **5 seconds**, ratio **720:1280 (9:16)**, standard **MP4**. Request fields, endpoint and task states were checked against Runway's official `@runwayml/sdk` **4.22.0** published package. Calls use API version `2024-11-06`. The clip is visual only: Romanian narration, burned-in captions, music and multi-clip editing are not added or billed. The Romanian copy is stored with the clip for review/future finishing.

The planning rate is **12 credits/second**, an estimated **60 credits** for this test. This is a locally pinned estimate, not a live provider quote. Before enabling paid submission, the owner must confirm that the current Gen-4.5 MP4 rate still matches that price. The API has no per-request maximum-price field; the app cannot override provider pricing or enforce limits on other applications/manual spending in the same Runway account. If pricing changes, keep this test disabled and update/retest its fixed price first.

### Spending safeguards

- Source-selected model/duration/ratio/format prevent client-side price inflation or extra audio/upgraded formats.
- Both `RUNWAY_PAID_TEST_ENABLED=true` and `RUNWAY_PRICING_CONFIRMED=true` are required, plus a separate explicit owner checkbox and Generate action on the chosen draft. These variables alone never submit a task.
- Private storage is checked and a read-only Runway organization call verifies at least 60 available credits before submission.
- The service-role-only SQL RPC atomically reserves **60 credits before the paid POST**, under a transaction lock. The per-test and per-calendar-month caps are fixed to **60**, enforced on the server and in SQL. Month boundaries use Europe/Bucharest. The single-test unique record also prevents extra submissions across month boundaries, concurrent clicks, rejected results or page reloads.
- The ledger conservatively retains the full reservation on failure, uncertain responses and missing cost reports. Provider-reported final credits are stored separately; no claimed refunds are invented. These are credit-based controls independent of the old illustrative EUR dashboard budget.
- The paid POST has **no automatic retry**. A timeout, crash after submission, lost task ID or missing database acknowledgement leads to `uncertain`; no second paid request is issued. Inspect Runway's task dashboard before any future recovery decision. Preparing another test requires a future deliberate implementation/policy change, not a retry button.

### Worker and storage

Runway does the GPU generation on its infrastructure. The Vercel Node.js worker at `/api/jobs/runway` ONLY retrieves task status and archives results; it cannot submit paid generation. It is authenticated with the existing `CRON_SECRET` and called once per minute, or the owner can click the read-only status-refresh button. Vercel minute cron and the 120-second request budget require a suitable plan such as Pro; no additional hosting service is inherently needed for this architecture. No automatic daily-generation job exists.

The worker uses a durable lease, bounded polling and safe error codes. It tracks pending/throttled/running/succeeded/failed/canceled tasks. Terminal cost is saved when reported; unknown cost remains unknown. Polling/storage retries never create another task. An abandoned submission is quarantined. Polling stops with a recorded failure after 1,440 attempts.

Successful outputs are copied before their temporary Runway URL expires into private Supabase bucket **`runway-videos`**, object **`<job UUID>/video.mp4`**. Downloads are restricted to exact allowed HTTPS output hosts, reject redirects and credentials, and are capped at 32 MiB. Runway and Supabase credentials are never forwarded to the media host. If upload acknowledgement is lost, the worker detects the existing deterministic object instead of downloading/overwriting it again. An interrupted archive can retry independently of generation. Allowlist failures require checking the actual legitimate provider output hostname; never allow arbitrary domains.

The protected preview endpoint creates a five-minute signed URL. Public visitors cannot list videos, access the service-role RPC or obtain preview links. After preview, the owner can approve or reject; review persists with a timestamp. Neither action publishes or generates more video. The original clip is retained for audit.

**Instagram publishing is source-locked during the test**, including the direct publishing worker, even if `INSTAGRAM_PUBLISHING_ENABLED=true`. OAuth/account management remains available. The existing Instagram setup guide's activation step does not override this first-test lock. Realistic synthetic media may require Meta's native AI labels; a caption alone is not treated as sufficient. No generated clip is automatically queued for Instagram. Removing this lock is a separate, explicit future change.

## Exactly what you need to do (no code to write)

1. **Supabase → SQL Editor → New query:** copy the complete supplied file `supabase/migrations/202610160005_runway_video.sql` and click **Run**, once. This is separate from existing commerce/Instagram migrations and does not modify customers, bookings, payments or subscriptions.
2. **Supabase → Storage → New bucket:** name it **`runway-videos`**, leave **Public bucket OFF**, allow **video/mp4**, and set its maximum file size to **32 MiB**. Do not add public read or browser upload policies. The server uses your existing service-role key.
3. **Vercel → ai-marketing-studio → Settings → Environment Variables → Production:** keep the verified `RUNWAYML_API_SECRET`, existing Supabase credentials, Studio credentials and `CRON_SECRET`. Add `RUNWAY_DATABASE_READY=true`, `RUNWAY_MONTHLY_CREDIT_LIMIT=60`, `RUNWAY_TEST_CREDIT_LIMIT=60`, `RUNWAY_OUTPUT_HOSTS=dnznrvs05pmza.cloudfront.net`, **`RUNWAY_PAID_TEST_ENABLED=false`**, and **`RUNWAY_PRICING_CONFIRMED=false`**. Keep `INSTAGRAM_PUBLISHING_ENABLED=false` too. No secret values should go into chat or GitHub.
4. **Vercel → Deployments → Redeploy** the version containing this feature. In **Settings → Cron Jobs**, confirm `/api/jobs/runway` is scheduled. The supplied configuration handles this; no code editing is needed. This cron polls only previously authorized tasks.
5. Open **https://www.thedivinework.com/studio/videos**, sign in, review the visual prompt and click **Pregătește conceptul fără cost**. No credits are spent. Review the separate Romanian caption. This is a five-second visual test, not a finished narrated advertisement.
6. **Before authorizing payment**, check current Gen-4.5 standard MP4 pricing in the official Runway API documentation/dashboard and confirm it remains **12 credits/second**, **60 credits for five seconds**. Ensure the API organization has at least 60 credits; Runway web-app subscription credits may be separate. Do not enable the test if that price differs. No credit purchase/top-up is performed by the app.
7. Only when you explicitly want this one paid test, set **`RUNWAY_PRICING_CONFIRMED=true`** and **`RUNWAY_PAID_TEST_ENABLED=true`** in Vercel and **Redeploy**. Return to the prepared draft, tick the explicit **Autorizez** checkbox, then click **Autorizează și generează · 60 credite** once. This click is the paid authorization and submission. The agent has not performed it.
8. Watch status in the library. The read-only worker checks progress periodically, then saves the video. If useful, click **Actualizează starea**; it never starts a new generation. On `uncertain`, check the Runway dashboard and do not try to create a replacement. On a storage allowlist failure, verify the legitimate Runway output host before adding an exact hostname in Vercel and redeploying.
9. When ready, click **Încarcă / reînnoiește previzualizarea**, watch the clip, and choose **Aprobă după vizionare** or **Respinge videoclipul**. Keep Instagram and daily generation off. Set `RUNWAY_PAID_TEST_ENABLED=false` and redeploy after the test as an additional safeguard; polling can still finish the already-authorized task.

## Test evidence

Automated tests mock all provider/media/storage calls. Postgres-backed tests cover concurrency, pre-submit reservation, strict limits, explicit authorization, insufficient balance, missing private storage, one-test uniqueness, provider failures, uncertain submission, crash recovery, read-only polling, archive retries, final credits, private data access, approval/rejection and Instagram's lock. Storage tests check private bucket enforcement, credential isolation, host/size/path checks and acknowledgement recovery. Browser tests cover private library access, free draft creation, the disabled paid button, preview and rejection. No real paid API call is needed to run the suite.
