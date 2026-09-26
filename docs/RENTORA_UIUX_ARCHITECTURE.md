# Rentora UI/UX Architecture & Design System v0.1

## 1. Product information architecture

### User workspace
- Discover: Home, Discover/Search, Categories, Listing Detail, Booking/Payment.
- Manage: My Listings, Create/Edit Listing, Owner Hub, Rental Management.
- Account: Activity/Rentals, Messages, Profile, Settings, Support.

### Primary navigation
Mobile:
1. Discover
2. Activity
3. List Item
4. Account
Messages and contextual actions are accessible from Account and contextual headers. Wallet/payment status is contextual, not a standalone financial wallet because Rentora does not custody user rental funds.

Desktop:
- Discover
- My Activity
- My Listings
- Messages
- Account
- persistent primary List Item CTA
- Admin entry only for authorized admins.

### Information hierarchy
Every screen follows:
1. page purpose
2. primary task/action
3. current state/status
4. supporting details
5. secondary actions

Financial information must distinguish:
- rental price
- security deposit
- Rentora platform fee
- total paid to Rentora
- direct P2P amount between renter and owner
- payout/treasury amounts for admin only

## 2. Design principles
- Mobile-first, Pi Browser first.
- RTL-first with true directional components, not mirrored hacks.
- Trust before decoration.
- One action hierarchy per screen.
- Progressive disclosure for complex flows.
- Server-authoritative values are visually marked as confirmed.
- No UI may imply escrow or custody of rental/deposit funds.
- No fake balance, transaction, payment or success state.
- Accessible touch targets, focus states and readable contrast.
- Motion communicates state and hierarchy, never decoration.

## 3. Visual tokens

### Brand
- ink: #26215C
- brand: #534AB7
- accent: #7F77DD
- brand-tint: #EEEDFE

### Semantic
- trust-text: #0F6E56
- trust-bg: #E1F5EE
- warning-text: #854F0B
- warning-bg: #FAEEDA
- danger: reserved for destructive/error states
- success: trust semantic, not generic decoration

### Surface
- light background: #FAFAFC
- light surface: #FFFFFF
- dark background: #0E0D1B
- dark surface: #16152B
- subtle border: rgba(148,163,184,.28)

### Shape
- card: 16px
- large surface: 20px
- button/input: 12px
- pill: 999px

### Spacing
Use a 4px base scale: 4, 8, 12, 16, 20, 24, 32, 40, 48.

### Typography
Vazirmatn is the primary Persian/RTL family. Use Inter/system fallback for Latin where appropriate. Establish explicit text roles: display, title, section, body, label, caption, numeric/financial.

## 4. Component system

Foundation:
- Button: primary, secondary, ghost, danger, loading, disabled.
- Input: text, number, search, select, textarea.
- Surface/Card.
- Badge/Status.
- Avatar/KYC/Trust indicator.
- Divider.
- IconButton.
- Tooltip/Help.
- Toast.
- Skeleton.
- EmptyState.
- ErrorState.
- ConfirmationDialog.

Marketplace:
- ListingCard responsive, one implementation with variants.
- CategoryRail.
- SearchBar.
- FilterSheet.
- PriceSummary.
- ListingGallery.
- OwnerTrustBlock.
- ReviewSummary.

Rental:
- BookingStepper.
- DatePicker.
- RentalSummary.
- FeeBreakdown.
- PaymentStatus.
- RentalTimeline.
- ContactUnlock.
- HandoverChecklist.

Communication:
- ConversationList.
- MessageThread.
- UnreadBadge.
- ReportFlow.

Admin:
- WorkspaceShell.
- MetricCard.
- DataTable.
- FilterBar.
- StatusTabs.
- DetailDrawer.
- AuditTimeline.
- TreasurySummary.
- PayoutStatus.

## 5. State system
All async surfaces use the same state language:
- loading: skeleton matching final layout
- empty: explanation + next useful action
- error: human-readable reason + retry
- pending: action locked with progress
- success: explicit server-confirmed result
- unauthorized: sign-in or permission explanation
- unavailable: distinguish temporary system failure from business restriction

## 6. Migration architecture
Keep the current UI intact while introducing the new system:
- new design tokens/primitives first
- new shell and navigation
- new ListingCard
- migrate one complete vertical flow at a time
- wire every migrated screen to existing contexts/services/APIs
- E2E validate real backend behavior
- remove legacy screen only after replacement passes validation

Never replace payment/auth/rental business logic merely to support visual redesign.

## 7. First migration order
1. Design tokens + primitives
2. App shell/navigation
3. Home + ListingCard
4. Discover
5. Listing Detail
6. Booking/Payment
7. Activity/Rentals
8. List/Edit + Owner Hub
9. Messages
10. Profile/Settings
11. Admin workspace

The payment flow is deliberately migrated as a complete vertical slice, not as isolated visual components.
