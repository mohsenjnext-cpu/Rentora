# Rentora Master Release Checklist

Scope: complete Rentora application release readiness for Pi Testnet / Pi Browser / Pi App Studio External App.

Status vocabulary: NOT STARTED, IN PROGRESS, IMPLEMENTED, TESTED, RUNTIME VERIFIED, BLOCKED, COMPLETE.

## 1. Product surfaces
- [ ] Home
- [ ] Discover / search / filters
- [ ] Item detail
- [ ] Public profile
- [ ] Private profile
- [ ] Listing creation
- [ ] Listing edit / pause / delete
- [ ] Owner Hub
- [ ] Activity / rentals
- [ ] Booking flow
- [ ] Conversations / chat
- [ ] Reviews
- [ ] Reports / disputes
- [ ] Settings / Help / Security / Support
- [ ] Admin dashboard
- [ ] Wallet / payout surfaces

## 2. Identity and authorization
- [ ] Pi SDK authentication
- [ ] Server session creation and validation
- [ ] Logout and session revocation
- [ ] Session-expiry handling
- [ ] User profile authority
- [ ] KYC authority and presentation
- [ ] Admin authorization
- [ ] ADMIN_PI_UIDS verified against authoritative Pi UIDs

## 3. Marketplace authority
- [x] Server-authoritative listing ownership
- [x] Server-authoritative listing financial fields
- [x] Listing lifecycle/status
- [x] Rental quote authority
- [x] Rental creation authority
- [x] Rental overlap protection
- [x] Rental lifecycle state machine
- [x] Contact-data authorization

## 4. Pi payments
- [ ] Server payment intent
- [ ] Locked payment metadata
- [ ] Authoritative Pi amount
- [ ] Pi createPayment
- [x] approve
- [x] complete
- [ ] cancellation
- [ ] failed/pending states
- [x] incomplete-payment recovery
- [x] idempotency / duplicate protection
- [x] transaction persistence
- [ ] payout / A2U flow
- [x] no client-side synthetic payment/rental confirmation

## 5. Messaging and trust
- [x] Conversation authorization
- [x] Message authorization
- [x] Contact-information filtering
- [x] Post-booking contact access
- [x] Conversation archive
- [ ] Unread/read state
- [ ] Cross-tab/device synchronization

## 6. Storage and data integrity
- [ ] D1 schema and migrations
- [ ] Foreign keys / uniqueness
- [ ] KV usage and TTLs
- [ ] R2/media handling
- [ ] Cache invalidation
- [ ] No sensitive business state in localStorage
- [ ] Server data remains source of truth

## 7. UI system and UX
- [ ] Shared design tokens
- [ ] Shared buttons/cards/badges
- [ ] Shared inputs/tabs
- [ ] Shared skeleton/empty/alert
- [ ] Shared modal/drawer/confirm
- [ ] Shared toast/navigation primitives
- [ ] Loading states
- [ ] Empty states
- [ ] Error states
- [ ] Success states
- [ ] Disabled states
- [ ] Unauthorized states
- [ ] RTL/Persian
- [ ] Mobile/Pi Browser
- [ ] Accessibility
- [ ] Dark mode

## 8. Security
- [x] API authentication
- [x] API authorization
- [ ] CORS
- [ ] Security headers
- [ ] Input validation
- [ ] Image validation
- [ ] Rate/abuse protections where required
- [ ] No secrets in client bundle
- [ ] No stack traces / sensitive errors
- [x] Legacy routes safely retired
- [ ] Payment tampering resistance

## 9. Verification
- [x] Unit/regression tests
- [ ] Worker syntax validation
- [ ] Frontend production build
- [ ] Full CI green on current HEAD
- [ ] Runtime API verification
- [ ] Pi Browser verification
- [ ] Mobile verification
- [ ] Payment E2E on Pi Testnet
- [ ] Admin flow verification
- [ ] Data-integrity verification
- [ ] Final regression

## 10. Deployment and release
- [ ] Cloudflare Worker deployment
- [ ] D1/KV/R2 bindings verified
- [ ] Production/Testnet environment verified
- [ ] Pi App Studio ownership validation
- [ ] validation-key.txt verified
- [ ] External App URL verified
- [ ] Deployment build verified
- [ ] Release configuration reviewed
- [ ] PR #40 final review
- [ ] PR #39 remains independently reviewed
- [ ] Final merge decision
- [ ] Post-merge smoke test

## Current verified checkpoint
- Latest verified work commit: f004e2de005a2ad210b9c747bdab91ec617ef198
- Rental/contact/chat audit: rental contact is restricted to authorized participants/admin, renter access requires completed payment plus confirmed/active/completed rental state, and listing contact is owner/admin-only.
- Conversation authorization: list/create/read/send/archive routes require authenticated participant access; conversation and message payloads derive sender/participants from D1 identities rather than client-supplied roles.
- Contact filtering: pre-booking messages pass through the server anti-bypass contact filter; post-booking unlock requires completed payment and an allowed rental state.
- Archived conversation hardening: POST /api/conversations/:id/messages now rejects archived conversations (409) so an archived thread cannot silently receive new messages and remain hidden from the active conversation list.
- Rental authority hardening: legacy POST /api/sync/rental returns 410 and directs clients to the authoritative quote -> /api/rentals flow; rental status transitions remain atomically guarded.
- Regression coverage added for archived-conversation write protection and legacy rental sync retirement.
- CI on the latest work commit: NOT RUN. The most recent observed GitHub Actions run was on c256532b6321ecf7fdb6c6e0c4b414f20e4051c7 and FAILED in `npm test` with 2 brittle assertions; those failures were diagnosed and the affected tests were corrected in subsequent commits. No Actions run/status is currently reported for 9354e625ddd946aef0845ae12ea74b9c0492f6eb yet.
- ADMIN_PI_UIDS authoritative-value blocker: BLOCKED until real Pi UIDs are supplied/verified.
- ADMIN_PI_UIDS authoritative-value blocker: BLOCKED until real Pi UIDs are supplied/verified.
- Payment approval race hardening: the intent is now atomically bound to the Pi payment before the external Pi approval call. A competing payment ID therefore cannot be approved and later orphaned by losing the D1 claim; transient approval/API failure preserves the same binding for retry.
- Payment-intent recovery hardening: a live intent already bound to a Pi payment is reused rather than reset, preventing a new intent/payment from orphaning the previously bound Pi payment.
- Payment regression coverage added for approval claim ordering and live payment-intent binding preservation.
- CI on the current HEAD: NOT RUN / NOT REPORTED. GitHub Actions returned no workflow runs and no combined status for f004e2de005a2ad210b9c747bdab91ec617ef198 at the time of this checkpoint.
