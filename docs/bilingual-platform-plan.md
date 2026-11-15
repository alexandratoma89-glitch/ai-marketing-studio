# Divine Works: public platform upgrade

## Existing architecture inspected

Next.js 15 App Router, React 19, TypeScript, Tailwind 4; existing Supabase service-role RPC storage and PGlite integration tests. Public Romanian free-reading, booking, membership, welcome, terms, privacy and bearer-link management routes. Separate HTTP Basic-protected `/studio` and `/api/studio`. Existing Stripe sandbox pricing (179 / 161.10 RON; 30-day trial then 29 RON), verified webhook processing, private booking links, mock/source-locked customer delivery, Meta/Google OAuth and approved owner-media publishing. Original public-domain Rider–Waite–Smith reproductions are already local with attribution.

Do not change Studio authentication, publication jobs/credentials, generation locks, existing records, payment activation, email activation, DNS or production secrets. Public account authentication is separate from Studio. Production deployment requires owner review and approval.

## Implementation sequence

1. Public-only design system, original homepage, header/footer, `/en` and `/ro` localization, browser/cookie preference and SEO. Existing public URLs receive compatible localized destinations; private Studio routes remain protected.
2. Reuse the 78 local public-domain card images; author bilingual card education, searchable/suit-filtered library, card detail pages and accessible free draw. Deliver the same chosen card and selected language through the existing opt-in email workflow.
3. Supabase Auth email/password/reset and Google, user-scoped RLS journal/notes/profile tables, secure CRUD, dated history/search, study progress, account settings/deletion. No production demo accounts or browser access to service-role keys. Test SQL owner isolation.
4. Localized booking, membership, consent, transactional status/management, terms/privacy and emails; keep existing availability, pricing, Stripe safety gates and email providers. Explain unavailable configuration rather than inventing live transactions.
5. Unit/integration tests, auth/Studio boundaries, browser flows in both languages, mobile layouts, production build, setup documentation, and a reviewable development branch. No production push.

## Configuration required outside the code

Apply additive migrations after review; configure Supabase public URL/anon key, Auth Google provider, redirect allowlist and Auth email sender. Existing live commerce and customer-email source locks remain in force. No paid subscription or provider configuration is changed automatically.

## Reference access

Attempted https://hermestarot444.com/journal/ on 2026-11-15; Cloud proxy denied CONNECT (403). The supplied journal concept can be implemented independently; no reference assets, text or proprietary layout were copied. Visual comparison with that reference remains unverified until network access is available.
