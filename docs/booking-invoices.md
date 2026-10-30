# Sandbox invoices for private readings

This extension creates a post-payment invoice through Stripe Checkout for **new sandbox booking sessions only**. It never creates an independent invoice or PaymentIntent in a webhook, reconciliation action, or page load. It does not retroactively invoice an earlier booking and does not enable live payments or Stripe Tax.

## Activation

1. Apply `supabase/migrations/202610300008_booking_invoices.sql` after existing commerce migrations 001–003. No invoice is created by this migration.
2. Set Production `COMMERCE_INVOICES_DATABASE_READY=true` and `COMMERCE_INVOICES_ENABLED=true`, retaining `COMMERCE_MODE=test` and a sandbox `sk_test_` secret. Both new flags default false in Production.
3. In the existing Stripe sandbox event destination, retain its nine events and add `invoice.finalized`, `invoice.finalization_failed`, `invoice.voided`, `invoice.marked_uncollectible`. Existing `invoice.paid` and `invoice.payment_failed` now also reconcile one-off invoices. Keep Snapshot payloads and the installed API version.
4. Review the sandbox's receipt/invoice email settings and sender branding. This implementation does not call an invoice send endpoint; Stripe's own settings determine its notifications. The booking-confirmation email remains in the existing mock queue.
5. Redeploy. Publish a new test appointment and complete a new sandbox payment. Old paid sessions without invoice creation enabled are not automatically invoiced.
6. Open `/studio/bookings`, follow **Factură de test** beside the booking, and use **Sincronizează factura existentă** if an invoice webhook is delayed. The order ID is carried into the private invoice page automatically. Confirm total 161,10 lei for an eligible first booking or 179 lei otherwise, paid status, and a usable hosted invoice/PDF.

## Payment and access rules

- The new payment-mode Checkout requests `customer_creation=always` and `invoice_creation.enabled=true`, with `order_id` metadata and an explicit TEST footer. Membership invoice generation is unchanged.
- The existing Checkout webhook confirms the booking. An invoice event alone does not confirm an appointment.
- Reconciliation retrieves the saved Checkout Session and its invoice from Stripe. It validates test mode, Checkout mode/reference, invoice association, invoice metadata, customer, currency, and exact price before writing anything. It uses only read endpoints.
- Invoice snapshots are unique per booking. Repeated events upsert the same document; terminal paid/void states cannot regress to draft/open. Provider state is retrieved afresh rather than trusting the event's potentially stale snapshot.
- Invoice links are restricted to HTTPS `invoice.stripe.com` and `pay.stripe.com`, with no credentials or nonstandard ports. RLS and RPC privileges deny anonymous/browser access. Studio routes require owner login and POST origin checks; a customer must present their signed management token to obtain the relevant document link. Public success pages and slot listings contain no invoice URLs.
- Refund status remains a booking/payment concern. A refund does not automatically void a Stripe invoice; credit-note/legal accounting workflows are a later step before live launch.
- The current inclusive manual tax snapshots and integer-bani amounts remain unchanged. Stripe automatic tax is disabled. No company identity, VAT registration, statutory tax rate or RO e-Factura compliance is asserted.

## Failure handling

A payment can be confirmed before invoice generation/retrieval finishes. If the invoice sync fails, Stripe can retry its webhook and the owner can read-sync the original booking. Neither path makes another charge or creates a replacement invoice. A missing invoice returns a clear pending/not-attached message. Do not make another payment for the same appointment to recover a missing document.

## Validation

Tests exercise the real additive SQL migration, exact totals/customer/order association, invalid/live provider data, early invoice events, repeated events, state regression, safe document URLs, and browser-role denial. Browser checks cover owner authentication, CSRF, management-token enforcement, mobile rendering and read-only synchronization. These mocks do not prove real invoice generation; the new sandbox checkout remains the final external acceptance check.
