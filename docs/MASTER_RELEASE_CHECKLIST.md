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
- [ ] Rental quote authority
- [ ] Rental creation authority
- [ ] Rental overlap protection
- [ ] Rental lifecycle state machine
- [ ] Contact-data authorization

## 4. Pi payments
- [ ] Server payment intent
- [ ] Locked payment metadata
- [ ] Authoritative Pi amount
- [ ] Pi createPayment
- [ ] approve
- [ ] complete
- [ ] cancellation
- [ ] failed/pending states
- [ ] incomplete-payment recovery
- [ ] idempotency / duplicate protection
- [ ] transaction persistence
- [ ] payout / A2U flow
- [ ] no client-side synthetic payment/rental confirmation

## 5. Messaging and trust
- [ ] Conversation authorization
- [ ] Message authorization
- [ ] Contact-information filtering
- [ ] Post-booking contact access
- [ ] Conversation archive
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
- [ ] API authentication
- [ ] API authorization
- [ ] CORS
- [ ] Security headers
- [ ] Input validation
- [ ] Image validation
- [ ] Rate/abuse protections where required
- [ ] No secrets in client bundle
- [ ] No stack traces / sensitive errors
- [ ] Legacy routes safely retired
- [ ] Payment tampering resistance

## 9. Verification
- [ ] Unit/regression tests
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
- Latest verified work commit: c256532b6321ecf7fdb6c6e0c4b414f20e4051c7
- Listing authority audit: ownership and financial authority remain server/D1 controlled.
- Rental authority hardening: legacy POST /api/sync/rental can no longer create/update rentals; it now returns 410 and directs clients to the authoritative quote -> /api/rentals flow.
- Regression coverage added for legacy rental sync retirement.
- Rental status endpoint currently enforces authenticated renter/owner access plus confirmed -> active and active -> completed transitions with atomic status guards.
- CI on the latest commit: NOT RUN yet; no current workflow run returned.
- ADMIN_PI_UIDS authoritative-value blocker: BLOCKED until real Pi UIDs are supplied/verified.
