# Rentora Project State

> **Canonical continuity file for the Rentora project.**
> This file is intentionally concise and operational. It is the handoff point for future sessions and must be updated after meaningful project decisions or completed work.

## 1. Project Mission

Rentora is a Pi Browser / Pi App Studio External App focused on P2P rental marketplace flows on Pi Testnet.

Core product principles:
- Real production-capable behavior, no mock/fake production flows.
- Server-authoritative marketplace, rental, payment, treasury and payout logic.
- P2P rental money/deposit is exchanged directly between renter and owner at handoff. Rentora does not hold renter/owner rental money in escrow.
- Rentora charges a platform fee through Pi payment infrastructure.
- Pi Testnet is the current target environment.

## 2. Rebuild Strategy: NON-NEGOTIABLE

The UI/UX redesign is **not a rebuild of Rentora**.

Existing backend, business logic, APIs, database, authentication, Pi integration, payment validation, rentals, treasury, payouts, security and deployment are the foundation to preserve.

The new UI/UX must be built **alongside the existing application**, progressively connected to the existing real services, tested end-to-end, and only then promoted to replace the current UI.

Rules:
- Do not recreate working backend/business functionality merely because the UI changes.
- Do not replace authoritative APIs with client-side state.
- Do not introduce mock payment, fake balances, fake transactions or fake production behavior.
- Do not remove the old UI until the replacement is validated.
- Any necessary backend change must be justified by the audit/integration requirement.
- Every migrated feature must work against the existing real backend before the old UI is retired.

## 3. Current Architecture

- Frontend: React + Vite.
- Main Cloudflare Worker entrypoint: `worker-gateway2.js`.
- API / legacy worker logic: `_worker.js`.
- Node/Express fallback: `server.js`, `backend/server.js`.
- D1: `RENTORA_DB`, authoritative application data.
- KV: `RENTORA_KV`, sessions/idempotency and related ephemeral data.
- Optional media storage/fallback through Cloudflare storage layers.
- Pi Platform API: `https://api.minepi.com/v2`.
- Pi Testnet Horizon configuration is present.
- Frontend contexts include authentication, Rentora state, language and theme.
- UI stack includes Tailwind, Lucide React and existing application components.

## 4. Existing Critical Capabilities To Preserve

- Pi authentication with server verification.
- HttpOnly session cookie through the Worker gateway.
- Admin authorization based on Pi UID.
- Server-authoritative rental quotes and financial calculations.
- D1-authoritative payment intent amount.
- Pi payment metadata binding and payment validation.
- Incomplete-payment handling.
- Rental overlap protection.
- Rental lifecycle: draft -> pending_payment -> payment_approved -> confirmed -> active -> completed.
- Treasury reservation/reconciliation and payout operations.
- Admin command center.
- Reports, reviews, conversations and messaging APIs.
- Security headers, dynamic CORS and legacy-route protections.
- Image validation/limits.
- Pi App Studio validation endpoint.

## 5. Current Admin Status

The Admin UID recognition issue for `avina60` was diagnosed and resolved.

Known verified Pi UID:
`8184ab4d-367c-402d-baf94a44`

Important:
- `ADMIN_PI_UIDS` must contain Pi UIDs, not usernames.
- Never place secrets, API keys or private wallet seed material in this file.

Current Admin UI exists but needs a full UX/UI redesign and functional audit, especially Settings, Treasury and Payout operations.

## 6. Current Payment / Treasury Direction

Business model:
- Rental total and deposit are exchanged directly between renter and owner.
- Rentora platform fee is the amount paid through Pi.
- Current default platform fee rate is 5%.
- Payment amount must remain server-authoritative.
- Treasury/payout functionality must use real reconciliation and real Pi/Testnet operations, not synthetic transaction identifiers.

Known product priority:
- Make platform-fee treasury visibility and transfer-to-owner-wallet flow reliable and operational.
- Admin must be able to inspect financial state and payout lifecycle clearly.

## 7. UI/UX Audit Status

Status: **IN PROGRESS**

Initial product-wide audit findings:
- App shell is state-driven in `src/App.jsx`, with page navigation, global modals and mobile/desktop navigation tightly coupled in one component.
- Current user IA is fragmented across Home, Discover, Activity, Owner Hub, Profile, Settings, plus modal-only Chat/Wallet/Help/Security/Support/Booking experiences.
- Mobile navigation is optimized for four destinations while several high-value actions remain hidden in a drawer or modal, creating discoverability debt.
- `ItemCard` and Home contain separate card implementations, creating visual/behavioral duplication that should converge into one listing-card system.
- `RentoraContext` still persists platform fee configuration and favorites/read-state in localStorage. Platform fee configuration is especially important because financial configuration must be server-authoritative; the redesign must not treat client config as the source of truth.
- `SettingsPage` is primarily a preferences/help hub. It has no backend-authoritative platform configuration surface, so admin settings cannot be treated as a working settings system yet.
- `AdminDashboardPage` is a large monolithic command center combining overview, finance, operations, users, listings, reports, audit and system concerns. It needs decomposition by information architecture and task.
- Admin console currently exposes `system.platformFeeRate` as read-only data. No discovered admin endpoint currently provides a write operation for platform fee settings, so the UI should not imply that this setting is editable until a real backend contract exists.
- `/api/wallet/withdraw` is explicitly retired with HTTP 410. Real payout behavior is now under payout operations, so Wallet UI and admin Treasury/Payout UI must distinguish legacy withdrawal from active payout lifecycle.
- Owner Hub currently calculates "revenue" from completed rental totals, while platform treasury revenue is based on completed platform-fee transactions. These are different financial concepts and must be separated clearly in the redesign.
- Booking UI already communicates the non-escrow P2P model and isolates the Rentora fee as the online Pi payment. This information hierarchy should be preserved, but the flow should be redesigned as a clearer multi-step transaction state experience.
- Activity is a dense 700+ line surface containing rental state, review/report/contact/handover interactions. It should become a task-oriented rental center with clear lifecycle states and contextual actions.
- List Item and Activity are among the largest user pages, indicating substantial form/workflow complexity that should be handled with progressive disclosure rather than simply restyled.
- RTL/Persian is a first-class requirement, but the current implementation mixes directional utility classes, hard-coded Persian fallbacks and English-only admin labels. The redesign needs centralized localization and direction-aware primitives.
- Visual system is partially centralized in `src/index.css` but many components still use hard-coded utility colors, radii and shadows. This creates token drift and should be replaced incrementally with design tokens.
- Existing loading/empty/error/success states are present across major flows, but they are implemented locally rather than through a consistent state-pattern system.
- No backend rebuild is implied by these findings. The redesign should consume the existing APIs/services and only add backend contracts where a missing product capability is proven necessary.

The next phase is a complete product-wide UI/UX audit before implementation.

Audit scope:
- Splash/loading
- Pi login/authentication UX
- Home
- Search/discovery
- Categories
- Listing cards
- Listing detail
- Create/edit listing
- Rental/booking
- Price/deposit/fee presentation
- Pi payment flow
- Rental confirmation/status
- My rentals
- My listings
- Messages/conversations
- Reviews
- Reports
- Profile
- Settings
- User navigation
- Admin command center
- Treasury
- Payouts
- Transactions
- Users
- Listings/moderation
- Reports
- Audit logs
- System/settings
- All loading, empty, error, success, pending, disabled and unauthorized states
- RTL/Persian typography and mobile-first behavior
- Accessibility
- Motion/interaction behavior

Audit outputs:
1. Current page/route inventory.
2. Component inventory.
3. Existing UX flows.
4. API/service dependencies per feature.
5. UX inconsistencies and usability issues.
6. UI inconsistencies and visual debt.
7. KEEP / REWORK / REPLACE decisions.
8. New information architecture.
9. New navigation model.
10. New Rentora Design System.
11. Migration plan that preserves existing functionality.

## 8. Design Direction

No final visual direction has been approved yet.

The target is:
- Cohesive across user and admin experiences.
- Mobile-first for Pi Browser.
- Clear, trustworthy marketplace UX.
- Strong hierarchy and readable financial information.
- Consistent RTL/Persian experience.
- Accessible and touch-friendly.
- Professional motion used for meaning, not decoration.
- Shared design tokens and reusable components.
- Admin and consumer UI share the same visual DNA while retaining different information architecture.

## 9. Planned Design System

To be defined after audit:
- Color tokens
- Typography
- Spacing
- Radius
- Shadows
- Breakpoints
- Icons
- Buttons
- Inputs/selects/search
- Cards/listing cards
- Avatars
- Badges/status
- Tabs
- Tables/data views
- Modals/drawers
- Toasts
- Skeleton/loading
- Empty/error states
- Confirmation patterns
- Navigation
- Motion rules

## 10. Settings Architecture Direction

The current Admin Settings experience is incomplete. The redesign should separate configuration from dashboard overview and make editable settings actually backend-authoritative.

Candidate structure:
- Platform
- Payments
- Marketplace
- Security
- System

A central settings registry may be introduced for non-secret, runtime-configurable product settings such as platform fee and marketplace rules, subject to technical audit.

Secrets must remain in Cloudflare Secrets and never enter a general settings registry.

## 11. Admin Information Architecture Direction

Proposed structure:
- Overview
- Marketplace
  - Listings
  - Rentals
  - Categories
  - Moderation
- Users
  - All Users
  - KYC
  - Suspended
  - User Details
- Finance
  - Treasury
  - Transactions
  - Platform Fees
  - Payouts
- Operations
  - Reports
  - Reviews
  - Support
  - System Alerts
- Settings
  - Platform
  - Payments
  - Marketplace
  - Security
  - System
- Audit Logs

This is a design direction, not yet an implementation decision. Validate against the actual existing routes/components during audit.

## 12. Tools / Working Method

Use the available repository and design tooling to inspect before changing:
- GitHub repository and history
- Figma for design system/prototypes where useful
- Existing code/components as the source of truth for integration boundaries
- Automated tests and build
- End-to-end/manual Pi Browser validation for real flows

Do not add tools merely for novelty. Every tool must support a measurable design, UX, accessibility, testing or implementation need.

## 13. Do Not Break

Never casually break:
- Pi authentication/session behavior.
- Admin authorization.
- Server authority over prices/fees/rentals/payments.
- D1 integrity and migration history.
- Payment metadata binding and Pi validation.
- Rental overlap protection.
- Treasury reservations/reconciliation.
- Payout state machine.
- Security controls.
- CORS/session behavior.
- Pi Testnet configuration.
- Existing working APIs used by migrated features.

## 14. Current Work State

Current phase: **Product-wide UI/UX audit in progress.**

Initial code inspection completed:
- `src/App.jsx` currently acts as a large route/state switcher with 10 primary page targets plus global modals and shared navigation.
- Current user surfaces include Home, Discover, Item Detail, Public Profile, List Item, Owner Hub, Activity, Profile and Settings; Admin is a gated surface inside the same shell.
- Shared shell currently includes Header, Sidebar, BottomNav and Footer, with global auth/wallet/booking/help/security/support/chat modals.
- `PiAuthContext` owns authoritative session restoration/admin state while `RentoraContext` still contains some local cached UI state; these boundaries must be respected during redesign.
- `AdminDashboardPage` currently combines navigation, treasury, payouts, users, listings, reports, transactions, audit and system concerns in one large page component. This is a major UX/maintainability redesign target.
- Current visual shell mixes Tailwind utility classes, hard-coded colors and some inline styling (including the ErrorBoundary), indicating a need for centralized design tokens/components.

Next audit action: continue route/component inventory and trace major user/admin flows to their existing services/APIs before defining the new design system.

Immediate next actions:
1. Inventory all routes/pages.
2. Inventory all reusable UI components.
3. Trace each major user/admin flow to its existing API/context/service.
4. Capture current UX states and inconsistencies.
5. Produce the audit findings.
6. Define the unified Design System and information architecture.
7. Build the redesigned UI beside the existing UI.
8. Integrate and regression-test feature by feature.
9. Replace legacy UI only after validation.

## 15. Change Log

### 2026-09-24
- Completed second audit pass: traced core user flows from UI/context/service to backend endpoints.
- Booking flow: BookingModal -> `POST /api/rentals/quote` -> `POST /api/rentals` -> Pi SDK payment -> `POST /api/payments/approve` -> `POST /api/payments/complete` -> private contact unlock. This is the primary migration-critical flow.
- Authentication flow: PiAuthContext -> `/api/auth/me` session restoration -> Pi login -> `/api/auth/pi-login` -> HttpOnly session cookie. Redesign must not recreate auth state in UI.
- Rental lifecycle actions in Activity/Owner Hub call `POST /api/sync/rental/status`; UI should represent the authoritative state machine rather than inventing client states.
- Messaging uses `/api/conversations` and message/archive endpoints. Chat is a real feature, not a UI-only modal.
- Admin treasury uses `GET /api/admin/console` and `POST /api/admin/payout`; wallet balance uses `GET /api/wallet/balance`. Legacy `/api/wallet/withdraw` is 410 and must not be presented as active.
- Important integration gap confirmed: admin console exposes platform fee rate but no discovered write endpoint exists, so platform fee editing is currently a backend capability gap, not merely a UI bug.
- Important UX/data gap confirmed: Owner Hub's "revenue" is rental gross/direct-P2P value, while Admin Treasury revenue is Rentora platform-fee revenue. Redesign must use distinct labels and financial cards.
- Important legacy debt confirmed: some contact/status wrappers still attempt to read `rentora_live_v1_session` from localStorage despite the server-cookie architecture. This should be removed during service-layer cleanup, not reintroduced in the new UI.
- Home has a separate mobile-only ItemCard implementation, confirming card-system duplication.
- BookingModal still computes a client-side fallback fee for display/compatibility. The authoritative server quote remains the source for actual payment, but the redesigned UI should visibly distinguish "estimated/fallback display" from server-confirmed financial values and prefer the server quote whenever available.
- No backend rebuild is planned. The next audit step is the complete component/route inventory and state-pattern matrix before Design System definition.

### 2026-09-24
- Admin UID issue diagnosed: admin authorization expects Pi UID, not username.
- Verified `avina60` Pi UID: `8184ab4d-367c-402d-baf94a44`.
- Admin recognition was corrected in Cloudflare configuration and confirmed resolved by the user.
- Agreed to a product-wide UI/UX redesign rather than isolated Admin redesign.
- Agreed that redesign is an alongside-build + migration, not a backend/application rebuild.
- Created this continuity file as the canonical project-state handoff.

## 16. Session Handoff Rule

At the end of each meaningful work session:
- Update CURRENT WORK STATE.
- Record important decisions.
- Record completed work and next action.
- Record relevant commit/PR references when available.
- Record blockers and known regressions.
- Keep this file factual and concise.

A future session should be able to read this file and continue the project without requiring the previous chat transcript.


### 2026-09-24 UI/UX audit pass: Route + component + state matrix
- App navigation is currently an in-memory state switch in `src/App.jsx`, not URL routes. This is workable for the legacy shell but makes deep-linking, browser history, shareable item/profile URLs and isolated screen testing harder.
- Primary screen inventory:
  - Home -> `HomePage` -> `RentoraContext` + `PiAuthContext` -> marketplace cached/server data -> states: populated, empty, refresh/loading, auth-dependent actions.
  - Discover -> `DiscoverPage` -> `RentoraContext` -> local search/filter/sort over marketplace data -> states: results, no results, filters active, mobile filter sheet.
  - Item Detail -> `ItemDetailPage` -> `RentoraContext` + reviews service + `BookingModal` -> reviews API + booking/payment APIs -> states: loading reviews, no reviews, owner/non-owner, authenticated/unauthenticated booking.
  - List/Edit Item -> `ListItemPage` (~763 lines) -> `RentoraContext` + `cloudSyncService` -> listing create/update + private contact/media APIs -> states: create/edit, validation error, upload, submitting, success, auth required.
  - Owner Hub -> `OwnerHubPage` -> `RentoraContext` -> listing/rental data + rental status API -> states: listing management, rental lifecycle, empty data, action pending/error.
  - Activity -> `ActivityPage` (~700+ lines) -> `RentoraContext` + service calls -> rental/review/report/contact/status APIs -> states: lifecycle-dependent actions, review/report, contact unlock, empty/loading/error.
  - Profile -> `ProfilePage` -> `PiAuthContext` + `RentoraContext` + reputation/review services -> profile update/media/reputation APIs -> states: signed-out gate, view, edit, upload, save/error.
  - Public Profile -> `PublicProfilePage` -> public profile service + marketplace/reputation data -> states: remote loading, missing user, listings/reputation.
  - Settings -> `SettingsPage` -> primarily client preferences/help/security/support -> no authoritative platform configuration contract.
  - Admin -> `AdminDashboardPage` -> `cloudSyncService` + admin APIs -> console/payout/reconciliation/status APIs -> states: unauthorized, loading, error/retry, overview, tables, payout create, reconciliation.
- Shared components identified as cross-cutting migration targets: Header, Sidebar, BottomNav, Footer, ItemCard, CategoryBar, EmptyState, PiAuthModal, WalletModal, BookingModal, ChatModal, HelpCenterModal, SecurityModal, SupportModal, ReportModal.
- Core integration matrix:
  - Auth: Pi SDK -> `PiAuthContext` -> `/api/auth/me`, `/api/auth/pi-login` -> HttpOnly session. Preserve exactly.
  - Booking/payment: BookingModal -> `/api/rentals/quote` -> `/api/rentals` -> Pi SDK -> `/api/payments/approve` -> `/api/payments/complete`. Preserve server quote/payment amount authority.
  - Rental status: Activity/Owner Hub -> `/api/sync/rental/status`. UI must render authoritative state machine.
  - Messaging: ChatModal/context -> `/api/conversations` and message/archive endpoints. Preserve unread/read behavior while removing unnecessary local session dependence.
  - Admin finance: console -> `/api/admin/console`, payout -> `/api/admin/payout`, wallet balance -> `/api/wallet/balance`; legacy wallet withdraw is retired (410).
- State-pattern requirement for redesign: every screen should define at least loading, empty, error, success, disabled/pending, unauthorized where applicable. These should be shared primitives rather than bespoke markup.
- Navigation finding: mobile BottomNav exposes Home/Discover/Activity/Profile only. Owner Hub, List Item, Wallet, Messages and Admin are secondary/drawer/modal destinations. New IA should elevate high-frequency actions without overcrowding the primary bar.
- Component debt: HomePage contains a second mobile-specific listing-card implementation while `ItemCard` already exists. Redesign should establish one responsive ListingCard with variants rather than maintaining two visual systems.
- Data-authority debt: `RentoraContext` initializes `platformConfig` from localStorage and uses it in client-side pricing calculations. This must not become the source of truth for actual money. Server quote/D1 remains authoritative.
- Service-layer debt: `cloudSyncService` still defines the historical `rentora_live_v1_session` storage key even though session authority is now the HttpOnly cookie. Any new UI must not depend on that key.
- Visual debt: App/Header/BottomNav/Sidebar/Admin use repeated literal colors, radii and shadows. New tokenized primitives should replace these incrementally.
- IA implication: user experience should be organized around three jobs: Discover & Rent, List & Manage, Account & Communication. Admin remains a separate operational workspace sharing the same visual system.


### 2026-09-25 Payment Engine implementation + CI verification
- Implemented the shared 50/50 platform-fee payment engine on `codex/shared-fee-payment-engine` using server-authoritative `payment_obligations` and owner activation-cycle state.
- Owner listing activation now creates an activation-cycle owner fee obligation; a listing cannot become bookable until the owner obligation is verified completed.
- Renter reservation payment remains tied to the authoritative rental obligation; confirmation requires the required fee state.
- Pi payment validation now binds payer, obligation, role/purpose, listing/rental, activation cycle and exact server amount. Completion reconciles the authoritative Pi transaction ID and is idempotent.
- Migration `0014_listing_activation_fee_state.sql` adds owner activation-cycle and fee-status state without inventing historical payments; legacy listings remain `legacy_unverified`.
- Latest regression-fix commit: `d7673b84c1694f54e4a0d699f53710995fa24724` (`test: match optional-chain payment intent input`).
- GitHub Actions CI run #499 (`36106270622`) is **GREEN**: security regression tests, Worker syntax validation and frontend build all passed.
- Product contract blocker remains: the approved model says the owner pays 50% of the platform fee at listing activation, while the total fee is defined by reservation economics. The current docs do not define an authoritative reservation/fee basis available at activation. Do not silently derive the owner fee from one day, listing price, or another invented basis. This must be explicitly decided before production deployment.
- Refund/lifecycle branches beyond the currently implemented payment/activation engine still require full backend implementation and end-to-end Pi Testnet validation before production release.
- Next action: resolve the owner-fee economic basis, then complete lifecycle/refund implementation and real Pi Testnet validation before merging/deploying.
