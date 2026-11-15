# Divine Works development review

This upgrades the existing repository and domain. Production, DNS, production secrets and live posts were not changed.

## Visual review

- [Desktop homepage](review/home-desktop.png)
- [iPhone-sized homepage](review/home-mobile.png)

The website uses original typography/layout with ivory, deep purple and gold, plus the existing locally attributed Rider–Waite–Smith art. There are no generated backgrounds or copied reference assets.

## Completed in code

- EN/RO public routes, remembered browser language, header switch, localized metadata/hreflang, sitemap, structured data and social previews.
- Full 78-card library, original bilingual meanings, upright/reversed/symbolism/relationship/career/reflection sections, search and suit filters.
- Random animated free draw and same-card email request with separate optional consent.
- Supabase customer authentication integration, reset, profile/language and deletion; owner-only persistent journal tables, reading CRUD/search/history, personal card notes and study progress.
- Localized booking and membership flows preserving real appointment availability, exact RON prices, recurring/trial disclosure, preserved sandbox integration, cancellation and email consent. Public purchases are now closed explicitly, with bilingual notices and free-reading/email signup links.
- Studio authentication, social connections, owner media, approval and publication jobs preserved.

## Configuration required before launch

Customer authentication is deliberately unavailable until the additive migrations, Supabase Auth, Google provider and email sender are configured and tested. Live payments and commercial customer-mail remain locked. Requested free-reading emails now have a separate gated Brevo provider; signup/recovery templates are supplied in both languages. No live Google sign-in, SMTP delivery or real charge was claimed as verified.

Follow [the setup guide](bilingual-platform-setup.md), which lists exact keys and values. Use a separate Google client for customer sign-in; do not replace the working YouTube credentials.

The supplied reference site returned a network CONNECT 403, so comparison against its live pages remains unverified. The public legal pages also require the actual operator, tax and retention details before live commerce.

## Validation

- 137 unit/integration tests passed, including actual two-user journal RLS, deletion isolation, localized order migration and preserved publishing behavior.
- All 35 browser checks passed across the full run and targeted follow-up. The welcome request test now waits for its HTTP response rather than timing out during development compilation.
- Browser checks cover both languages, library filtering, free-reading email request/consent, responsive pages at 390/768/1440px, journal CRUD/search/progress, session clearing, existing Studio/Instagram/Facebook/YouTube interfaces, MOV and iPhone photo handling.
- Production CAPTCHA checks passed for missing settings, rendering failure, script failure and successful rendering.
- Production build and TypeScript validation passed. Social preview image endpoint returned PNG successfully.
- Browser journal interactions use a mocked customer session. Real SQL ownership is tested separately. Live provider setup still needs the explicit end-to-end verification in the setup guide.

Production deployment remains subject to owner review and approval.

For the free-only launch, follow [the dashboard connection guide](connect-free-website.md). External settings and real inbox/authentication verification remain pending; no production database or deployment was changed.
