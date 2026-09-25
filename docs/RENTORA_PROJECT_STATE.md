# Rentora Project State

## Current phase

Rentora is in the product-wide UI/UX research and redesign phase.

Non-negotiable strategy:
- Do not rebuild the backend or business logic.
- Build the new UI alongside the existing application.
- Preserve real Pi authentication, payments, rentals, D1/KV, treasury, payout, security and deployment contracts.
- Migrate real capabilities into the new UI one flow at a time.
- Validate each migrated flow against the real backend before retiring the old UI.
- No mock/fake payment, balance, transaction, rental or financial state.

## Research-first design process

The agreed process is:

Research -> Problems -> User Goals -> Competitive / community / specialist patterns -> Useful Patterns -> Rejected Patterns -> Rentora Requirements -> UX Decision -> UI Specification -> Prototype / Figma -> Implementation -> Real Backend Integration -> Validation

Figma and visual implementation must not start before the relevant research and UX decisions are complete.

## Existing architecture

- React 18 + Vite frontend
- Cloudflare Workers
- D1 as authoritative marketplace/financial database
- KV for sessions/idempotency and supporting state
- Pi Platform API / Pi Browser integration
- Existing user and admin capabilities remain the foundation

## Existing UI/UX audit

The app currently uses a state-driven shell in src/App.jsx with Home, Discover, Item Detail, Public Profile, List Item, Owner Hub, Activity, Profile, Settings and Admin surfaces.

Shared surfaces include Header, Sidebar, BottomNav, Footer, ItemCard, CategoryBar and multiple flow modals.

Known redesign targets include:
- duplicated mobile/desktop listing-card implementations
- fragmented navigation
- monolithic AdminDashboardPage
- inconsistent visual tokens
- locally implemented loading/empty/error states
- RTL/localization inconsistencies
- financial/trust information hierarchy
- Activity and List Item complexity
- legacy client-side session references in some service wrappers

## Existing design architecture

docs/RENTORA_UIUX_ARCHITECTURE.md defines the current high-level IA, navigation direction, financial distinctions, design principles, component families, state system and migration order.

## Home research milestone

Research document: docs/RENTORA_HOME_RESEARCH.md

Commit: d79807ff02f489e182a308534299b346d216beaf

Home research v0.1 establishes:
- Home is the marketplace front door, not a marketing-only landing page.
- Discovery/search is the primary Home interaction.
- Categories are discovery accelerators.
- There must be one canonical responsive ListingCard.
- Trust signals must be concrete and authoritative.
- Marketplace statistics must have explicit authoritative definitions or be removed.
- Listing ordering must be intentional; arbitrary array order must not be called featured.
- Empty/error/loading states are part of the design.
- Mobile Pi Browser is first-class.
- Search/filter complexity should not be dumped onto Home.
- No financial or marketplace state may be invented by the UI.

## Current next step

Research the canonical ListingCard and discovery-result experience before producing Home wireframes or Figma work.

Focus:
- information density
- image treatment
- price/unit
- location
- rating/reputation
- KYC/trust
- favorite
- primary CTA
- mobile scanability
- no-image/no-review states
- Home -> Listing Detail -> Booking transition

## Change log

- 2026-09-24: Began research-first Home UX phase.
- 2026-09-24: Added docs/RENTORA_HOME_RESEARCH.md v0.1.