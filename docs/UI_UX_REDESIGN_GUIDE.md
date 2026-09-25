# Rentora UI/UX Redesign Guide & Living Checklist

> مرجع زنده بازطراحی UI/UX Rentora. UI جدید کنار UI قدیمی ساخته می‌شود و فقط پس از تکمیل، اتصال به سرویس‌های واقعی، تست و تأیید جایگزین UI اصلی خواهد شد.

## اصول اجرایی

1. **Research first:** برای هر تصمیم مهم، ابتدا مسئله و گزینه‌های موجود بررسی می‌شوند.
2. **Decision before build:** تصمیم طراحی/تجربه کاربری قبل از پیاده‌سازی ثبت می‌شود.
3. **Real capability only:** UI جدید باید به API و business logic واقعی فعلی متصل شود. Mock و simulated production مجاز نیست.
4. **Legacy stays:** UI قدیمی تا پایان migration حذف یا غیرفعال نمی‌شود.
5. **Complete means tested:** صرف ساخته‌شدن ظاهر به معنی Complete نیست.
6. **Server authority:** قیمت، fee، payment state و داده‌های حساس همچنان server-authoritative هستند.
7. **Mobile/Pi Browser first:** تجربه موبایل، Pi Browser، RTL و فارسی جزو معیارهای اصلی هستند.
8. **One shared system:** کامپوننت‌ها، tokenها، state patternها و navigation تا حد ممکن مشترک و قابل استفاده مجدد باشند.
9. **No silent product decisions:** تصمیم‌های مهمی که نیازمند انتخاب محصولی یا trade-off واقعی هستند در Decision Log ثبت و در صورت نیاز از مالک محصول پرسیده می‌شوند.

## Definition of Done

هر صفحه/قابلیت زمانی **Complete** است که این زنجیره طی شده باشد:

**Research → Decision → UI Build → Real Backend Integration → Loading/Empty/Error/Success/Disabled/Unauthorized States → RTL/Persian → Mobile/Pi Browser → Accessibility → Regression Tests → Final Review → Migration**

---

## 1. Discovery & Product Architecture

- [ ] Audit کامل UI فعلی
- [ ] Inventory کامل صفحات، modalها، drawerها و shared components
- [ ] Matrix قابلیت‌ها در برابر APIهای واقعی
- [ ] تعریف Information Architecture جدید
- [ ] تعریف navigation برای Mobile/Pi Browser
- [ ] تعریف navigation برای Desktop
- [ ] تعریف مسیرهای قابل share/deep-link و routing strategy
- [ ] تعریف مرزهای User Workspace و Admin Workspace
- [ ] ثبت تصمیم‌های product/UX در Decision Log

## 2. Design System

- [x] Color tokens
- [x] Typography tokens
- [x] Spacing tokens
- [x] Radius tokens
- [x] Shadow/elevation tokens
- [x] Breakpoints
- [ ] Icon rules
- [ ] Button system
- [ ] Input/select/search system
- [ ] Card system
- [ ] Avatar system
- [ ] Badge/status system
- [ ] Tabs
- [ ] Modal/drawer
- [ ] Toast/notification
- [ ] Skeleton/loading
- [ ] Empty states
- [ ] Error states
- [ ] Confirmation/destructive actions
- [ ] Navigation components
- [ ] Motion rules
- [ ] Accessibility rules
- [ ] RTL/direction primitives
- [ ] Localization/Persian text strategy

## 3. Core Marketplace

### Home
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Real data integration
- [ ] Loading/empty/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [x] Final review
- [ ] Migration

### Discover
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Real data integration
- [ ] Filters/search/sort states
- [ ] Loading/empty/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

### Listing Card
- [ ] Research
- [ ] Decision
- [x] Unified shared component
- [x] Replace duplicated mobile implementation
- [x] Real listing state integration
- [x] Loading/placeholder state
- [x] RTL/mobile/accessibility
- [x] Regression tests
- [ ] Final review
- [ ] Migration

### Item Detail
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Authoritative listing/owner data
- [ ] Availability state
- [ ] Booking entry
- [ ] Contact privacy/unlock state
- [ ] Report/review entry points
- [ ] Loading/empty/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

### Booking & Payment
- [ ] Research
- [ ] Decision
- [ ] Server quote as source of truth
- [ ] Rental creation flow
- [ ] Owner fee obligation state
- [ ] Renter fee obligation state
- [ ] Pi createPayment
- [ ] Approve
- [ ] Complete
- [ ] Incomplete payment recovery
- [ ] Pending/cancelled/failed states
- [ ] Payment metadata display
- [ ] Contact unlock after verified completion
- [ ] RTL/mobile/Pi Browser
- [ ] Regression/E2E tests
- [ ] Final review
- [ ] Migration

## 4. Listing & Owner Management

### List Item
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Create listing integration
- [ ] Edit listing integration
- [ ] Image upload validation states
- [ ] KYC/owner state
- [ ] Activation fee state
- [ ] Paused/active state
- [ ] Validation/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

### Owner Hub
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Listing management
- [ ] Rental management
- [ ] Activation/payment obligations
- [ ] Revenue terminology separated from Rentora treasury revenue
- [ ] Pending/active/completed states
- [ ] Loading/empty/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

## 5. Account & Communication

### Activity / Rentals
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Renter rental list
- [ ] Owner rental list
- [ ] Rental lifecycle/status actions
- [ ] Payment state
- [ ] Contact unlock
- [ ] Loading/empty/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

### Profile
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Authoritative user data
- [ ] KYC/profile state
- [ ] Preferences
- [ ] Loading/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

### Public Profile
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Authoritative public user endpoint
- [ ] Dynamic item-owner KYC synchronization
- [ ] Listings/reputation presentation
- [ ] Privacy boundaries
- [ ] Loading/empty/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

### Messages / Conversations
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Conversations API
- [ ] Messages API
- [ ] Archive/unarchive states
- [ ] Unread/read state
- [ ] Rental context
- [ ] Report/block safety affordances where supported
- [ ] Loading/empty/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

### Reviews
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Rental-linked review flow
- [ ] Review display
- [ ] Validation/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

### Reports
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Report creation
- [ ] Status display
- [ ] Privacy/permission states
- [ ] Loading/empty/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

### Settings
- [ ] Research
- [ ] Decision
- [ ] New UI
- [ ] Preferences
- [ ] Language/direction
- [ ] Theme
- [ ] Help/security/support
- [ ] Session/logout behavior
- [ ] Remove UI dependence on legacy localStorage session data
- [ ] Loading/error states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

### Wallet / Finance
- [ ] Research
- [ ] Decision
- [ ] Balance presentation
- [ ] Platform-fee obligation presentation
- [ ] Transaction history
- [ ] Admin payout visibility where authorized
- [ ] Ensure retired /api/wallet/withdraw is not presented as active
- [ ] Clear separation of user P2P rental money vs Rentora platform-fee money
- [ ] Loading/error/permission states
- [ ] RTL/mobile/Pi Browser
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

## 6. Admin Workspace

### Admin Dashboard
- [ ] Research
- [ ] Decision
- [ ] New IA
- [ ] Decompose monolithic AdminDashboardPage
- [ ] Overview
- [ ] Users/KYC
- [ ] Listings
- [ ] Rentals
- [ ] Reports
- [ ] Transactions
- [ ] Treasury
- [ ] Payouts
- [ ] Operational states
- [ ] Permission/unauthorized states
- [ ] RTL/localization
- [ ] Responsive admin behavior
- [ ] Regression tests
- [ ] Final review
- [ ] Migration

### Admin Settings / Platform Configuration
- [ ] Research
- [ ] Identify authoritative backend capabilities
- [ ] Decide whether platform fee configuration needs an admin write endpoint
- [ ] Do not create a UI-only editable fee setting
- [ ] Build only after backend contract is authoritative
- [ ] Audit permission/authorization
- [ ] Tests
- [ ] Final review
- [ ] Migration

## 7. Cross-Product Quality

- [ ] No sensitive business state in localStorage
- [ ] Remove new UI dependency on legacy session storage
- [ ] Server-authoritative financial display
- [ ] Consistent payment state handling
- [ ] Consistent authorization handling
- [ ] Consistent API error mapping
- [ ] Consistent loading states
- [ ] Consistent empty states
- [ ] Consistent destructive confirmations
- [ ] Accessibility keyboard/focus review
- [ ] Touch target review
- [ ] RTL visual review
- [ ] Persian localization review
- [ ] Pi Browser real-device review
- [ ] Performance review
- [ ] Responsive breakpoint review
- [ ] Motion/reduced-motion review
- [ ] Security/privacy UI review
- [ ] Full regression suite
- [ ] Production build
- [ ] Final legacy-vs-new feature parity audit
- [ ] Final migration plan
- [ ] Legacy UI removal/deactivation
- [ ] Main branch CI green
- [ ] Production deployment verification

## Decision Log

Use this template for every non-trivial decision:

```
### [DATE] Feature / Decision

Problem:
Research:
Options considered:
Decision:
Reason:
Backend impact:
UI impact:
Risk:
Status:
```

## Change Log

| Date | Area | Change | Status |
|---|---|---|---|
| 2026-09-25 | Project setup | Created living UI/UX redesign checklist and workflow | ✅ |


## Baseline Audit Snapshot — 2026-09-25

Verified on `main` before implementation work:

- `src/App.jsx` exists as the current application-level screen/state switcher.
- `src/index.css` is the main shared styling/token surface.
- `src/context/RentoraContext.jsx` remains a major shared state surface.
- Primary page implementations verified: Home, Discover, Item Detail, Owner Hub, Activity, Profile, Public Profile, Settings, Admin Dashboard.
- The product-wide migration is **not complete**. This tracker intentionally keeps every page at incomplete status until its full Definition of Done is met.
- PR #39 remains separate and open; it is not part of the UI replacement and must not be merged automatically.

### First Research Queue

1. Establish the new IA/navigation and route strategy before broad page migration.
2. Establish design tokens and shared component primitives before duplicating page-specific styling.
3. Converge listing-card implementations before expanding marketplace surfaces.
4. Audit server-authoritative financial display paths before touching booking/payment presentation.
5. Decompose the largest account/admin surfaces only after their workflows and state contracts are mapped.



## Research Decision 01 — Navigation & Routing — 2026-09-25

**Finding:** The current `src/App.jsx` uses an in-memory `currentTab` state switcher. It already supports the major product surfaces, but it does not provide URL-addressable routes/deep links.

**Options considered:**
1. Keep the in-memory switcher and only restyle it.
2. Introduce a client router and make primary screens URL-addressable while preserving existing handlers and APIs.
3. Rewrite the app shell and navigation together with a new routing architecture.

**Decision:** Choose **option 2 as the migration target**. Introduce URL-addressable primary routes incrementally, while keeping the existing screen switcher operational during the redesign. Do not rewrite backend contracts or business logic for routing.

**Reason:** The redesign needs shareable/deep-linkable screens and isolated screen testing, but a full shell rewrite would unnecessarily couple navigation work to every page migration.

**Implementation order:** routing foundation → new shell/navigation → page-by-page migration → remove legacy switcher after parity and regression validation.

**Status:** Research/decision complete. Implementation remains unchecked until built and tested.


## Research Decision 02 — Design Tokens & Shared Styling — 2026-09-25

**Finding:** src/index.css is already the shared styling surface and the project uses Tailwind CSS 4.3.x. Tailwind v4 supports CSS-first @theme variables for colors, typography, spacing, radii, shadows, breakpoints and other reusable design tokens.

**Options considered:**
1. Keep page-specific hard-coded values and introduce tokens only when a component is migrated.
2. Establish a shared token layer in src/index.css first, while preserving existing semantic variables and legacy visual behavior.
3. Replace the existing styling system wholesale with a new component library.

**Decision:** Choose option 2.

**Reason:** It creates one source of truth for the redesign without forcing a risky visual rewrite. Existing classes and components can continue working while new UI uses the same token layer. Tailwind's @theme is appropriate because the current project is already on Tailwind v4.

**Implementation:** Added additive Rentora tokens for semantic colors, typography, spacing extensions, radii, elevation, breakpoints and motion easing. Existing :root semantic variables now reference the token layer where safe. No legacy component was removed or behaviorally rewritten.

**Status:** Research/decision/initial token implementation complete. Individual shared components remain incomplete until they are migrated and tested.


## Research Decision 03 — Listing Card Convergence — 2026-09-25

**Finding:** HomePage had a separate mobile-only listing card implementation while ItemCard already served the desktop/grid path. This duplicated ownership logic, favorite behavior, imagery, actions and financial display.

**Decision:** Treat ItemCard as the shared listing-card primitive and migrate mobile Home to it progressively. Preserve the existing mobile visual wrapper during migration where necessary, but do not maintain two independent business implementations.

**Status:** Shared `ItemCard` now owns both default and compact/mobile rendering paths. Home mobile no longer defines a second listing-card business implementation. A focused regression test verifies the convergence. Full listing-card completion remains pending for migration.



- Home now distinguishes initial empty/loading state via the provider's server-sync lifecycle; cached listings continue to render immediately.
- Shared ItemCard exposes a skeleton variant used by mobile and desktop Home loading states.
- Regression coverage now verifies the loading state and skeleton variant.
### 2026-09-25 — Listing Card Convergence Implementation

- Home mobile now renders the shared `ItemCard` with `variant="compact"`.
- Favorite, owner detection, KYC, rating, image fallback, pricing and rent/manage actions remain inside the shared component.
- Added a focused Node regression test covering the absence of the old `MobileItemCard` and preservation of shared behavior.
- CI verification is pending for the new PR because GitHub has not yet reported a workflow run/status for the new head commit.

- Hook-safety review completed for the skeleton variant by isolating its render path from the stateful card hooks.
