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

Status: **NOT STARTED YET**

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
