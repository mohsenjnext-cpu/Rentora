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
- [x] Pi SDK authentication
- [x] Server session creation and validation
- [x] Logout and session revocation
- [ ] Session-expiry handling
- [ ] User profile authority
- [ ] KYC authority and presentation
- [x] Admin authorization
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
- [x] Server payment intent
- [x] Locked payment metadata
- [x] Authoritative Pi amount
- [x] Pi createPayment
- [x] approve
- [x] complete
- [x] cancellation
- [x] failed/pending states
- [x] incomplete-payment recovery
- [x] idempotency / duplicate protection
- [x] transaction persistence
- [x] payout / A2U flow
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
- [x] R2/media handling
- [ ] Cache invalidation
- [x] No sensitive business state in localStorage
- [x] Server data remains source of truth

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
- [x] Image validation
- [x] Rate/abuse protections where required
- [x] No secrets in client bundle
- [x] No stack traces / sensitive errors
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


- Failed/cancelled Pi payment convergence: payment intent creation now reconciles the bound Pi payment before reuse; a Pi payment reported as cancelled/failed retires the dead intent binding, returns the rental to pending_payment, clears its KV intent snapshot, and allows a fresh authoritative intent. Incomplete-payment reconciliation applies the same convergence without confirming the rental.
- R2/media audit: upload validates declared MIME against file magic bytes, enforces a 2MB decoded limit, stores to R2 when available with immutable cache metadata, falls back to KV, and GET /api/images/:id supports R2/KV retrieval with lazy R2 migration and nosniff headers.
- CI for payment convergence commit 60c6fdea9bc174a023497972e4fbc84186959d64: NOT RUN / no workflow run reported yet.


- Abuse/rate-limit hardening: KV-backed request throttles now cover Pi login, payment intent/approve/complete/incomplete, uploads, reports, and message sends. Limits are scoped per short-lived IP bucket and return HTTP 429 with retry metadata. This is a basic edge throttle, not a replacement for durable WAF/bot controls.
- CI for the latest security-throttle test commit 2d3a82ecf7e7bde827ee284f1b6a6151315bb43f: NOT RUN / no workflow run reported yet.


- Session transport hardening: server sessions are now issued through an HttpOnly, Secure, SameSite=None `rentora_session` cookie; logout revokes the KV session and clears the cookie. The sync client no longer reads browser-stored session bearer tokens and sends credentialed requests.
- Client secret audit checkpoint: Pi server API keys remain server-only; browser code uses the public API base URL and Pi SDK access token only for the login handoff. No server API key was found in the audited client service/config files.
- CI after auth hardening commit a8527d08c8a65b645083a01fda0603b2112c2d44: NOT RUN / no workflow run reported yet.


- Cookie-session compatibility: optional-auth `/api/sync/all` and listing read routes now resolve the same HttpOnly session cookie instead of depending only on a bearer Authorization header.
- CI after cookie/session hardening commit 272947465c719103b77ed8341f0e4f0dfbf64824: NOT RUN / no workflow run reported yet.


### 2026-09-25 payout and validation audit checkpoint
- A2U payout implementation audit: the active Cloudflare entrypoint is `worker-gateway2.js` (wrangler main). Its payout flow uses a durable `payout_operations` state machine, unique idempotency key, lease ownership, treasury reservation, Pi A2U creation/approval/completion, Testnet/direction/UID/amount/metadata validation, transaction identity collision checks, reconciliation queue, and stale-operation recovery. This is IMPLEMENTED at code/audit level, but remains unverified against a live Pi Testnet payout.
- Pi official A2U contract cross-check: current Pi documentation confirms A2U is a server-side flow and currently Testnet-only; the active gateway creates the server payment with the authenticated app-user UID, validates the returned payment, builds/signs the blockchain payment from the developer wallet, and completes the Pi payment after blockchain submission. Live Testnet execution is still required for RUNTIME VERIFIED status.
- Wallet/payout surface remains NOT STARTED at product-surface level for the end-user withdrawal UI. The legacy `POST /api/wallet/withdraw` path is intentionally retired with 410 rather than providing synthetic payout behavior.
- Legacy/fallback note: `_worker.js` still contains an older A2U implementation, but `wrangler.toml` points production Worker entry to `worker-gateway2.js`. The duplicate legacy implementation should not be treated as the release authority and remains a cleanup/convergence item.
- A2U configuration blocker remains: `ADMIN_PI_UIDS` in `wrangler.toml` contains `avina60,mohsenjnext`; these values must be verified as authoritative Pi UIDs before admin payout is considered runtime-ready. No UID was invented or substituted during this audit.
- Input-validation audit checkpoint: high-risk payment/admin mutations enforce required identifiers, enum/status validation, amount bounds against D1 authority, body-size limits, payment identity/amount/metadata/network checks, and wallet-address rejection for direct payout targeting. A broader mutation-by-mutation validation pass remains open.
- Error-leakage hardening: active gateway and legacy worker now suppress internal exception text for 5xx responses, and raw Pi approval/completion payloads are no longer returned to clients. Server logs retain diagnostic details.
- Latest security-error hardening commit: `2627efe042c7ba9bedd2a62404c86a08f5cb6b90`. CI for this HEAD is NOT RUN / NOT REPORTED.

- Local rental-cache removal: `cloudSyncService` no longer reads or writes `rentora_live_v1_rentals`; rental/payment state is rehydrated from the server and remains authoritative in D1. A legacy removal key is still cleared on logout for cleanup.
- Cache-invalidation status remains open because broader public-media/browser-cache invalidation semantics still need a final endpoint-by-endpoint audit.
- CI after rental-cache removal commit `08edfec0606a885739fa69b7ac77b23edca76dd2`: NOT RUN / NOT REPORTED.
