# The Divine Work — Stripe integration plan and review

Prepared 29 October 2026 for https://www.thedivinework.com, tarot readings. Requested Stripe products: Payments, Invoicing, Tax.

## Provenance and limits

This is a manual plan based on the checked-in implementation and installed Stripe SDK, not output from `stripe_implementation_planner` and not a review of the Stripe account. No Stripe credentials, account settings, live charges, invoices, tax registrations, or webhook endpoints were changed.

The requested setup was attempted in order:

1. `codex plugin add stripe@openai-curated` failed: `stripe` was not found in that marketplace. The Stripe plugin is not listed among this session's installable recommendations.
2. `codex mcp add stripe --url https://mcp.stripe.com` failed because `/home/agent/.codex/config.toml` is on a read-only filesystem. No OAuth authentication occurred; the planner tool is not exposed to this session.
3. `npx skills add https://docs.stripe.com` was attempted (with a writable temporary npm cache after the default cache failed). The fallback could not download skills. A request to the official MCP documentation also received an HTTP proxy 403. Official documentation was not fetched or installed.

To use the actual planner, complete the plugin/MCP installation in a Codex client that can write its own configuration, authenticate with Stripe through its OAuth flow, then open a new session exposing `stripe_implementation_planner`. A local MCP configuration in this container would not automatically add tools to this chat.

## Business model and intended architecture

Use hosted Stripe Checkout for customer payments. Keep card data on Stripe, reserve an appointment on the server, and fulfill only from authenticated webhook events. Use the same order/customer identifiers for invoices and tax records.

| Offer | Current price | Stripe path |
| --- | --- | --- |
| Private reading, 30 minutes, audio/video | 179 lei | Checkout payment mode |
| Eligible first private booking | 161,10 lei, 10% off | Server-owned discount; not a browser-supplied coupon |
| Free email reading | 0 lei | No payment or invoice required solely to request it |
| Optional daily-reading membership | 30 days free, then 29 lei/month | Existing Checkout subscription mode; preserve separately agreed terms |

Do not change historical amounts or existing subscriptions when adding Invoicing or Tax. Existing order snapshots include currency, price, and tax configuration. Confirm the business country, legal identity, address, VAT status, and invoice requirements before selecting tax treatment. Live consultation and automated/digital content may need different tax classifications; do not guess a product tax code from the word “tarot.”

## Existing implementation review

| Area | Evidence in repository | Assessment and next action |
| --- | --- | --- |
| Payments | `lib/commerce/stripe.ts`, checkout route | Hosted Checkout implemented in TEST mode. No live integration/account connection verified. |
| Prices | `pricing.ts`, service, migrations 002/003 | Integer bani, RON, server-enforced first-booking price. Preserve these protections. |
| Secret handling | `safety.ts`, server-side SDK | Only `sk_test_` keys accepted. No browser key is required for a server redirect to hosted Checkout. |
| Payment methods | Checkout parameters | Card allowlist using the installed SDK's `allowed_payment_method_types` field. Reassess supported methods only after testing asynchronous payment paths. |
| Checkout creation | `startCheckout` | Stable idempotency key per order; definite rejection releases hold, ambiguous failures retained for reconciliation. |
| Slot reservation | SQL and reconciliation | Atomic booking admission and exclusive slots. Expiry is reconciled against Stripe rather than merely releasing a possibly paid appointment by wall-clock time. |
| Fulfillment | Webhook route and `applyStripeEvent` | Raw-body signature verification, test-event enforcement, event dedupe, amount/currency/mode checks, and outbox. Success-page redirects do not confirm payment. |
| Refunds | Service and refund webhook | Future test bookings can request an idempotent refund; final status follows the refund event. Finalize the business cancellation policy before live use. |
| Membership | Subscription snapshot and invoice events | Existing trial/renewal/cancellation handling. Recurring billing inherently uses subscription invoices; this does not implement ad-hoc Invoicing for private readings. |
| Invoicing | No booking `invoice_creation` setting or invoice record | Gap. One-off paid-reading invoices, retrieval links, numbering/legal fields, and lifecycle reconciliation need implementation. |
| Tax | `automatic_tax.enabled=false`; optional manual inclusive TEST rate | Gap. Stripe Tax is not configured. Existing manual VAT validation is not automatic tax calculation. |
| Notifications | Commerce runtime and jobs | Customer confirmations remain simulated. Stripe-generated receipts/invoices are configured independently in Stripe; do not assume the Brevo setup controls them. |
| API version | Installed Stripe 23.x SDK | Installed SDK default is `2026-09-30.endive`. Align the sandbox webhook endpoint and test payloads. SDK mocks are not evidence of a real Stripe session. |

## Ordered implementation plan

### 1. Verify the account and complete one sandbox payment

- Owner completes Stripe account/business verification with an accurate tarot service description and country. Confirm account capability/restrictions directly with Stripe if applicable.
- In a Stripe sandbox, place the test secret key in Vercel as Secret `STRIPE_SECRET_KEY`; never paste it in chat, commit it, or put it in a `NEXT_PUBLIC_` variable. The webhook signing secret is a different secret.
- Apply the existing free-tarot, commerce, and RON migrations 001–003 to the intended test database; configure `COMMERCE_DATABASE_READY=true`, `COMMERCE_MODE=test`, the management signing secret, canonical site origin, and Turnstile. See `commercial-launch.md` for the complete existing prerequisites.
- Register sandbox endpoint `https://www.thedivinework.com/api/commerce/webhook` and save its signing secret as `STRIPE_WEBHOOK_SECRET`. Configure the installed API version deliberately.
- Existing handled events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.expired`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`, `charge.refunded`.
- Publish one test slot. Verify first and returning customer prices, a successful card, required authentication, decline, cancellation, event replay, and two concurrent bookings for one slot. Use synthetic customer details and test payment methods.

### 2. Add Invoicing in sandbox

- First confirm whether invoices are needed after online payment, before payment, or both. Default recommendation here: a post-payment invoice for each private-reading Checkout payment; avoid creating a separate invoice that charges for the same booking twice.
- For payment-mode Checkout, add `invoice_creation.enabled=true` and a suitable customer-creation/reuse strategy. Use the installed SDK types to validate fields and re-check current Stripe docs when available.
- Add immutable invoice/customer references to order storage, plus authenticated invoice retrieval for the relevant customer. Never expose invoice PDFs or hosted invoice URLs in a public order lookup.
- Configure the correct legal seller name, address, applicable VAT identifiers, branding, numbering, line-item description, and refund/credit-note process. Collect customer billing identity and tax IDs only as required.
- Handle and deduplicate invoice finalization/failure/paid/void/uncollectible and relevant credit-note/refund events. The current one-off `invoice.paid` branch does not track these invoice records.
- Decide when Stripe should send invoices/receipts. Avoid duplicate Stripe and Brevo notifications. Test emails only to the owner's approved test inbox until the sending behavior is reviewed.
- If manual invoicing is also required, build an owner-only draft/preview step. Sending or finalizing an invoice must be a deliberate action, with idempotency and an order link.

### 3. Configure Stripe Tax in sandbox

- Confirm business location, VAT registration/exemption, customer locations and service types. Do not infer registration, an exemption, or a statutory rate from the website domain.
- Configure applicable registrations and product classifications in Stripe Tax. Distinguish private human-led consultations from automated subscription content where the facts require it.
- Decide the displayed price treatment. Existing consumer prices are final totals; retain inclusive pricing if that remains the approved commercial policy.
- Add an explicit tax mode (off/manual/automatic). Automatic tax and manually attached `tax_rates` must be mutually exclusive. Keep legacy order tax snapshots unchanged.
- Enable `automatic_tax` only for the configured automatic mode. Add location/tax-ID collection as required; test missing location, taxable/non-taxable cases, VAT-ID scenarios, and invoice rendering.
- Persist calculated subtotal, tax, total, currency, invoice reference and tax outcome. Reconcile webhook amounts against the server's approved price/tax policy instead of loosening existing checks to accept arbitrary totals.
- Confirm with the accountant how Stripe invoices/Tax records fit Romanian RO e-Factura, local reporting, and filing obligations where applicable. Stripe setup alone is not a determination that those duties are satisfied.

### 4. Release after external acceptance tests

- Real sandbox tests must establish Checkout completion, webhook delivery/replay, invoice accuracy, and tax behavior. Existing mocks cannot establish any of these external facts.
- Maintain test/live separation, server secrets, duplicate protection, and webhook authentication. Confirm support email, cancellation/refund terms, fulfillment readiness, and payment/invoice email behavior.
- Keep the current live-charge lock until a separate, concrete production release is authorized. This task does not activate live payments or reprice contracts.

## Verification performed

`node --experimental-strip-types --test lib/commerce/*.test.ts`: **21 passed, 0 failed**. These cover actual local SQL behavior, SDK webhook-signature validation, and mocked provider flows. No Stripe sandbox API request or live request was made. Application payment code was not changed by this review.

## Priority improvements

1. Complete a real sandbox Checkout and signed webhook round trip with the owner's securely configured test key.
2. Add one-off invoice creation, persistence and authenticated access; current membership invoice handling is not enough for Payments + Invoicing.
3. Resolve business/tax facts, then implement an explicit Stripe Tax mode with stored tax outcomes and matching invoice/webhook checks.
4. Add owner-visible reconciliation for unconfirmed payments, failed invoices, and missing customer notifications.
5. Pin/review SDK and webhook API versions during upgrades, with provider contract tests in addition to local mocks.

## Official references for the next connected session

These links are supplied for the owner/next connected session; they were not fetched in this environment:

- https://docs.stripe.com/mcp.md
- https://docs.stripe.com/payments/checkout
- https://docs.stripe.com/payments/checkout/post-payment-invoices
- https://docs.stripe.com/payments/checkout/automatic_taxes
- https://docs.stripe.com/invoicing
- https://docs.stripe.com/webhooks

## Implementation update — 30 October 2026

The owner completed one real Stripe **sandbox** Checkout at 161,10 lei and showed a `confirmed` booking in Studio, establishing that the original payment/webhook round trip worked. No live payment occurred.

One-off sandbox invoice support has now been added behind separate migration/configuration flags. See [booking-invoices.md](booking-invoices.md). It includes post-payment Checkout invoice creation, private stored invoice links, signed customer access, and owner read-only reconciliation. External invoice generation is not yet verified. Automatic Stripe Tax, legal seller setup, and credit-note/accounting integration remain outstanding; the business itself is not yet registered in Romania.
