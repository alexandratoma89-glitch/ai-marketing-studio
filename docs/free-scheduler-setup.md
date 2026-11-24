# Scheduler without a Vercel upgrade

The Vercel Hobby deployment rejects sub-daily cron expressions. `vercel.json` therefore has no built-in cron jobs. The website, booking phone banner and social links can deploy on Hobby. Existing worker routes, approval checks, source locks and uncertain-result protection remain in place.

The GitHub Actions workflow **Website scheduled jobs** calls the four existing worker routes roughly every five minutes. Standard Linux runners are free for public repositories under GitHub's current Actions policy; private repositories have included-minute quotas. Check repository visibility and Actions billing before enabling a private-repository schedule. GitHub schedules can be delayed or skipped and are not an exact-minute publishing service. Inactive public repositories can have scheduled workflows disabled after 60 days; check Actions if automation stops.

## Owner setup

1. Terminal: run `openssl rand -hex 32`. Save the generated text securely. Do not share it in chat.
2. Vercel → ai-marketing-studio → Settings → Environment Variables → Add:
   - Key: `SCHEDULER_SECRET`
   - Value: the generated text
   - Type: **Secret**
   - Environment: **Production**
3. GitHub repository → Settings → Secrets and variables → Actions → **New repository secret**:
   - Name: `SCHEDULER_SECRET`
   - Secret: the **same generated text**
4. Redeploy the latest Production deployment in Vercel so the variable applies.
5. GitHub → Actions → **Website scheduled jobs** → **Run workflow** → Branch **main** → Run workflow. Confirm every endpoint reports `accepted`. This runs existing queues: only already-approved posts can publish. It creates no new approvals and sends no marketing campaigns.

The first automatic run may need Actions to be enabled. The workflow requires no checkout, repository permissions, Studio password, social tokens, Supabase credentials or Brevo keys. It is inactive without the scheduler secret. It accepts only HTTPS, follows no redirects, logs no response bodies, and does not retry ambiguous HTTP operations. Existing server-side locks and record-level idempotency still apply on later runs.

Keep the existing `CRON_SECRET` unchanged. It remains a valid authorization token and is used by existing configuration checks. The new token is independently revocable: removing it from Vercel stops external calls. Remove it from both services if retiring the workflow.

Until this setup is complete, **automatic publishing, generation polling and marketing synchronization do not run on Vercel Hobby**. Owner-triggered actions in Studio remain available; the marketing page has **Sincronizează acum**, and the publishing page can process approved due work. Do not use retry/re-upload for an uncertain platform result; use the existing reconciliation controls.
