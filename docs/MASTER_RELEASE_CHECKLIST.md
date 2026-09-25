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
- [x] cancellation
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
- [x] D1 schema and migrations
- [x] Foreign keys / uniqueness
- [x] KV usage and TTLs
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
- [x] CORS
- [x] Security headers
- [ ] Input validation
- [ ] Image validation
- [ ] Rate/abuse protections where required
- [ ] No secrets in client bundle
- [ ] No stack traces / sensitive errors
- [x] Legacy routes safely retired
- [x] Payment tampering resistance

## 9. Verification
- [x] Unit/regression tests
- [x] Worker syntax validation
- [x] Frontend production build
- [x] Full CI green on current HEAD
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
- Latest verified work commit: 832ef625a5b3909de975f71f0a3ad5e7e6f6c80e
- Rental/contact/chat audit: rental contact is restricted to authorized participants/admin, renter access requires completed payment plus confirmed/active/completed rental state, and listing contact is owner/admin-only.
- Conversation authorization: list/create/read/send/archive routes require authenticated participant access; conversation and message payloads derive sender/participants from D1 identities rather than client-supplied roles.
- Contact filtering: pre-booking messages pass through the server anti-bypass contact filter; post-booking unlock requires completed payment and an allowed rental state.
- Archived conversation hardening: POST /api/conversations/:id/messages now rejects archived conversations (409) so an archived thread cannot silently receive new messages and remain hidden from the active conversation list.
- Rental authority hardening: legacy POST /api/sync/rental returns 410 and directs clients to the authoritative quote -> /api/rentals flow; rental status transitions remain atomically guarded.
- Regression coverage added for archived-conversation write protection and legacy rental sync retirement.
- CI on the latest work commit: NOT RUN. The most recent observed GitHub Actions run was on c256532b6321ecf7fdb6c6e0c4b414f20e4051c7 and FAILED in `npm test` with 2 brittle assertions; those failures were diagnosed and the affected tests were corrected in subsequent commits. No Actions run/status is currently reported for 9354e625ddd946aef0845ae12ea74b9c0492f6eb yet.
- ADMIN_PI_UIDS authoritative-value blocker: BLOCKED until real Pi UIDs are supplied/verified.
- Payment approval race hardening: the intent is now atomically bound to the Pi payment before the external Pi approval call. A competing payment ID therefore cannot be approved and later orphaned by losing the D1 claim; transient approval/API failure preserves the same binding for retry.
- Payment-intent recovery hardening: a live intent already bound to a Pi payment is reused rather than reset, preventing a new intent/payment from orphaning the previously bound Pi payment.
- Payment regression coverage added for approval claim ordering and live payment-intent binding preservation.
- CI on the current HEAD: NOT RUN / NOT REPORTED. GitHub Actions returned no workflow runs and no combined status for f004e2de005a2ad210b9c747bdab91ec617ef198 at the time of this checkpoint.
- Payment completion hardening: completion now rejects a client txid that conflicts with the Pi-authoritative transaction txid and checks existing transaction identity before confirming the rental. This prevents a reused/conflicting txid from silently colliding with another payment intent.
- Payment completion regression coverage added for Pi txid mismatch and cross-intent transaction conflicts.


### Latest Audit Updates
- Incomplete Pi reconciliation transaction identity hardening: transaction collisions are rejected before rental confirmation; same-intent duplicate reconciliation is idempotent; reconciliation transaction inserts are strict rather than `INSERT OR IGNORE`.
- CI run #809: FAIL, 310/311 tests passed; sole failure was a brittle optional-chaining regex assertion in `tests/ui-item-detail-redesign.test.js`, now corrected.

- Pi cancellation convergence: POST /api/payments/cancel now verifies ownership, refuses completed payments, marks the payment intent and still-payable rental cancelled, and clears the short-lived payment-intent KV record. Native Pi onCancel now invokes this server path.
- Payment tampering resistance checkpoint: approve/complete/incomplete flows bind payment intent, payer, amount, metadata, and Pi transaction identity; transaction uniqueness is enforced with strict inserts plus identity prechecks.
- CI run #821 on the checklist checkpoint failed because one regression test still expected the old INSERT OR IGNORE transaction persistence; implementation is intentionally strict INSERT. The test was corrected in 46f1cf943d4560d47d1fa6624b73055dbc955633 and requires a fresh green run before verification is marked complete.

- CI diagnosis: runs #830-833 failed only in regression assertions expecting legacy `INSERT OR IGNORE`; those tests were corrected. Completion now also returns idempotently when the same transaction is already bound to the same intent, avoiding duplicate inserts during concurrent retries.

- Payment-intent expiry hardening: an expired Rentora intent with a bound Pi payment is reconciled against the Pi API before replacement; active/unfinalized bindings are retained and their Rentora expiry is renewed instead of orphaning the Pi payment.
- Native Pi error reconciliation: SDK onError now forwards an identified payment to the server-side incomplete-payment reconciliation path, so client errors do not invent a final payment state.
- CORS hardening: preflight now permits Idempotency-Key and X-Idempotency-Key used by payout operations; origin allowlisting remains explicit and wildcard origins are rejected.
- CI status after latest fixes: IN PROGRESS/QUEUED on current branch HEAD 832ef625a5b3909de975f71f0a3ad5e7e6f6c80e6; previous failures were stale runs on earlier commits and are not treated as current verification.

- Security/storage audit checkpoint: API responses now include CSP, HSTS, X-Frame-Options, nosniff, and restrictive Permissions/Referrer policies; schema audit confirms D1 foreign keys, uniqueness constraints, payment/rental state checks, payout operation guards, and KV-backed payment-intent TTL usage.

- CI verification: runs #860 and #861 completed successfully on the checklist-updated HEAD, confirming the current test/build workflow is green after the stale transaction assertions were removed.
