# Runway readiness

Repository inspection found no Runway SDK, generation adapter or generation route. The existing `VideoGenerator` is an interface only; dashboard generation remains a demo notification. Merely setting `RUNWAYML_API_SECRET` does not connect generation.

The protected `/studio/runway` diagnostic reads that exact server-only variable at request time. A GET to the diagnostic shows presence/format booleans only. Its explicit same-origin POST performs one authenticated **GET https://api.dev.runwayml.com/v1/organization**, using `X-Runway-Version: 2024-11-06`. It does not invoke any generation/task/upload endpoint. Redirects are rejected, the request times out after ten seconds, and only a sanitized result is returned. Provider bodies, headers, keys, fingerprints, credit balances and exception messages are never logged or returned by the application. No automatic retries or scheduled diagnostic requests are added.

A successful result establishes that Runway accepted the deployed key for read-only organization access. It does not establish available credits, model entitlements, generation success or authorization to spend money. A future controlled generation still needs an implemented server adapter, an explicitly selected model/input/duration and a budget limit, plus the owner's explicit spending approval. Automatic generation remains unavailable.

1. In **Vercel → ai-marketing-studio → Settings → Environment Variables**, ensure `RUNWAYML_API_SECRET` is scoped to **Production**, without surrounding spaces or quotes. Never use a `NEXT_PUBLIC_` name. Do not share the value in chat.
2. Open **Deployments**, select the deployment containing this diagnostic and choose **Redeploy** after changing any environment variable.
3. Open **https://www.thedivinework.com/studio/runway** and use your existing Studio login. Confirm that the server secret is marked present.
4. Click **Verifică accesul fără generare** once. `Runway a acceptat cheia` means the read-only authentication test succeeded. A denied response requires checking the Runway organization's key and permissions; a network/provider error does not prove the key is invalid.
5. Leave generation disabled. No generation implementation or paid test was added by this verification task.

The development workspace has no Runway secret and no deployment credential access. Unit tests use mocked responses; they do not verify the key stored in Vercel. Production readiness must remain unverified until the deployed diagnostic succeeds.

## Hosting and monthly cost audit

The diagnostic is a Next.js Node.js API route hosted by Vercel. There is **no Runway generation worker, Runway cron, task queue, generation submission route or completion poller** in the current application. Only Instagram has a configured cron. A future asynchronous integration can submit a task in a short Vercel request and use durable database state plus later scheduled checks; Runway performs video generation on its own infrastructure. A separate hosting service is not inherently required for that architecture. Long-running local rendering or a continuously running process would require a different execution model and a separate assessment of hosting limits.

The Studio budget uses browser React state (`budget=250`, `expense=0`) plus hard-coded demo expenditure (`62.4` EUR). It is not persistent accounting and is not linked to Runway. There is no enforced monthly spending limit, atomic credit/cost reservation, provider-usage reconciliation, currency conversion, or retry spending allowance. A key's existence or an authenticated read-only response cannot make these controls ready. Before any paid generation, implement and test durable per-month limits, per-test maximum cost, atomic reservation before submission and reconciliation after completion. Keep generation disabled until the owner authorizes a specific bounded paid test.
