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

- [ ] Color tokens
- [ ] Typography tokens
- [ ] Spacing tokens
- [ ] Radius tokens
- [ ] Shadow/elevation tokens
- [ ] Breakpoints
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
- [ ] Final review
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
- [ ] Unified shared component
- [ ] Replace duplicated mobile implementation
- [ ] Real listing state integration
- [ ] Loading/placeholder state
- [ ] RTL/mobile/accessibility
- [ ] Regression tests
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
