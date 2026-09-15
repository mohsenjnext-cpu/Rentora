# RENTORA — MASTER IMPLEMENTATION PROMPT FOR ARENA

## Mission

Work on the existing Rentora repository as a production-minded engineering agent. The goal is to make the current application coherent, reliable, secure, lightweight, and genuinely usable as a **Pi Network Testnet/Sandbox External App**.

Do not create a parallel rewrite. Do not replace working architecture merely for aesthetics. Fix the existing system at its actual source of truth and remove contradictions between UI state, API state, and database state.

The forensic audit in `AUDIT_REPORT.md` is a useful map, not an authority. **Verify every important claim against the current code, tests, schema, and runtime behavior.** A passing test suite does not prove the UI works if a real runtime bug remains.

## Current baseline

- Repository: `mohsenjnext-cpu/Rentora`
- Relevant recent fix commit: `f57db3c05b8ad0efb578c187748a6151a6bbec42`
- Recent audit document: `AUDIT_REPORT.md`
- Target: Pi Testnet/Sandbox only
- Frontend: React 19 + Vite + Tailwind CSS
- Backend: Cloudflare Worker Gateway
- Database: Cloudflare D1
- Short-lived/session state: Cloudflare KV
- Persistent media: Cloudflare R2
- Pi API: Pi Testnet API
- Production Worker architecture must remain compatible with Cloudflare Workers.

## Non-negotiable constraints

1. **Pi Testnet only.** Never introduce Mainnet behavior, Mainnet credentials, or a production-wallet shortcut.
2. Never put Pi Server API keys, session secrets, or other server credentials in `VITE_*` variables or browser code.
3. The browser is not authoritative for money, rental state, listing state, permissions, reviews, users, or transaction completion.
4. D1 is authoritative for marketplace records and rental/payment business state.
5. KV is for sessions, short-lived replay/idempotency state, and existing compatibility use cases. Do not turn KV into the marketplace database.
6. R2 remains private. Do not expose public bucket URLs or presigned URLs to the browser unless there is a demonstrated security requirement and the existing architecture is deliberately changed.
7. Every privileged operation must be authorized server-side.
8. Do not reintroduce demo login, mock Pi tokens, fake payments, client role escalation, or localStorage as a payment/rental source of truth.
9. Do not weaken existing payment verification, anti-bypass chat controls, review constraints, or privacy boundaries while fixing unrelated UI issues.
10. Do not silently delete migrations, active deployment configuration, security-sensitive code, tests, or required dependencies.

---

# PHASE 1 — RECONNAISSANCE BEFORE MODIFICATION

Inspect the current repository first.

Verify:

- `worker-gateway.js`
- `worker-entry.js`
- `_worker.js`
- `wrangler.toml`
- `schema.sql`
- all migrations
- `src/App.jsx`
- `src/context/*`
- `src/services/*`
- all pages/components referenced by navigation
- Pi authentication/payment code
- listing, rental, review, conversation, contact, report, admin, avatar and media APIs
- current tests and package scripts
- current build/deployment configuration

Do not assume the audit is current. Establish the actual source-of-truth flow for every critical feature.

Create an internal checklist mapping:

`UI action → frontend service → API endpoint → authorization → D1/KV/R2 mutation → returned state → UI state refresh`

A feature is not considered fixed merely because its endpoint returns HTTP 200.

---

# PHASE 2 — FIX VERIFIED RUNTIME AND NAVIGATION FAILURES

## BUG-001: App.jsx undefined `items`

Inspect `src/App.jsx` and the `useRentora()` destructuring used by `handleRentItem()`.

The audit identified a real failure where `items` is referenced without being available in scope. Verify this against the current code.

Fix the actual root cause, not just the resulting exception.

Then verify direct booking from every entry point that can call the booking handler:

- Home
- Discover
- Item Detail
- Profile
- Public Profile
- Chat/related item actions

Required result:

`tap Rent → correct listing loaded → booking modal opens → authoritative quote obtained → Pi payment flow starts`

No "restart app" message is acceptable as a substitute for fixing a broken handler.

## Navigation/state recovery

Audit all buttons that currently say or imply:

- restart app
- try again
- refresh
- go back
- retry
- nothing happened

Every actionable control must either perform the intended action or show a precise recoverable error.

Do not use `window.location.reload()` as a generic repair for application state bugs.

Ensure that:

- tab changes render the correct page
- browser back/forward behavior remains coherent
- selected listing survives the intended navigation
- modals close correctly
- stale loading states cannot trap the user
- API 401 causes session recovery/logout correctly
- API 403 displays an authorization message rather than a generic crash
- network failures show retryable UI without corrupting local state
- failed mutations do not optimistically leave the UI claiming success

---

# PHASE 3 — MARKETPLACE SOURCE OF TRUTH

This is a critical architectural requirement.

## Listings

A listing must be stored and served authoritatively from D1.

Required lifecycle:

`Create → Draft → Publish → Public visibility → Edit → Pause/Deactivate → Reactivate → Delete`

Public users must be able to discover active published listings that they do not own.

Owners may see their own drafts/non-public listings where appropriate.

Deleted listings must not appear in normal public discovery.

Do not rely on a browser-only `items` array as the authoritative marketplace database.

## Rental quotes

The client must never be trusted to decide the payment amount.

The flow must be:

`listing ID + requested dates → server validates listing and dates → server calculates authoritative quote from D1 listing/rental data → server creates payment intent using that server-owned amount → Pi payment → server verification → rental state transition`

Never accept an arbitrary client-supplied amount as authoritative.

The server must validate:

- listing exists
- listing is active/publishable
- renter is not the owner
- dates are valid
- requested period is available
- price comes from authoritative listing data
- platform fee is calculated server-side
- payment intent belongs to the authenticated Pioneer
- payment metadata is bound to the internal payment intent/rental
- Pi network is Testnet
- Pi payment status is acceptable before approval/completion
- amount and memo match the server-created intent
- payment ID belongs to the expected user
- transaction ID, when supplied by Pi, matches the expected payment
- duplicate completion is rejected or safely recovered

No client-side balance, localStorage payment marker, or fake completion may establish a completed rental.

---

# PHASE 4 — AUTHORIZATION AND ADMIN SECURITY

Admin access must be impossible to obtain by manipulating browser state.

The effective rule must be server-side:

`authenticated user + D1 admin role + allowed ADMIN_PI_UIDS policy = admin`

Verify every admin endpoint, not only the dashboard page.

At minimum inspect:

- admin overview
- user listing
- user status changes
- listing moderation
- reports/disputes
- configuration/fee operations
- destructive database operations

A normal authenticated user must receive 403 from protected admin APIs.

The UI must also hide admin navigation for non-admins, but this is only presentation. The server authorization is the real security boundary.

Session lifecycle:

- login creates a short-lived signed session
- server stores a hashed session token in KV
- authenticated API calls validate the session server-side
- logout/revocation invalidates the session server-side
- expired/revoked sessions return 401
- client clears stale credentials after 401

Do not rely solely on deleting a browser localStorage value for revocation.

---

# PHASE 5 — AVATAR / MEDIA PERSISTENCE

Profile avatar changes must persist across:

- page reload
- logout/login
- another device/session where the same account is used
- profile page
- public profile where policy permits
- header/sidebar/avatar surfaces

Inspect the current avatar upload path end-to-end.

Required architecture:

`browser upload → authenticated Worker endpoint → validate bytes/type/size → R2 object → D1 user avatar reference → API response → UI refresh`

Do not store the authoritative avatar only in React state or localStorage.

Preserve the private R2 bucket model and safe object naming.

Handle replacement/deletion without orphaning large numbers of old objects.

---

# PHASE 6 — RENTAL LIFECYCLE

Make the rental state machine explicit and consistent.

Expected conceptual flow:

`Listing → date selection → server quote → payment pending → payment verified → confirmed → handover → active → return → completed → review`

Exceptional states must include appropriate handling for:

- cancelled
- payment failed
- payment incomplete
- disputed
- expired/unpaid

Every state transition must have a server-side authorization rule.

The UI must render state from authoritative API data, not from optimistic local assumptions.

Verify:

- owner cannot rent own listing
- unavailable dates cannot be double-booked
- unpaid rentals cannot unlock private contact
- cancelled/refunded/unpaid rentals cannot retain inappropriate privileges
- only eligible rental participants can access handover/return actions
- review eligibility is tied to the completed rental

---

# PHASE 7 — PRIVATE CONTACT AND CHAT

Preserve the existing secure architecture.

Pre-booking:

- allow normal rental inquiries
- anti-bypass filter remains active
- block phone/email/social-platform bypass attempts according to the existing policy

Post-booking:

- contact access requires verified eligible rental state/payment
- only the renter and owner can access the private coordination information

Conversations:

- only participants can read messages
- only participants can send messages
- archived conversations behave consistently
- no legacy `/api/sync/chat*` path should silently regain functionality
- do not reintroduce file/image attachments if the product intentionally remains text-only

Do not weaken the filter just to make a test pass. Fix false positives at the narrowest possible scope.

---

# PHASE 8 — REVIEWS / REPUTATION

Preserve the rental-tied review architecture.

A review must be tied to:

- rental
- listing
- reviewer
- reviewee

Enforce server-side:

- valid rating range 1–5
- eligible completed rental
- participant relationship
- one allowed review per applicable relationship
- no arbitrary review creation from a public endpoint

Public reputation must be calculated from authoritative reviews.

New users with no reviews should not display a misleading numerical reputation.

---

# PHASE 9 — UI/UX COHERENCE

Do not perform a cosmetic redesign detached from functionality.

Use this information architecture as the target model:

### Guest
- Home
- Discover
- Listing Detail
- Public Profile
- Login with Pi

### Authenticated user
- Home
- Discover
- My Activity
- Owner Hub
- Messages
- Profile
- Settings

### Listing lifecycle
- Create
- Draft
- Publish
- Public visibility
- Edit
- Pause
- Delete

### Rental lifecycle
- Listing
- Dates
- Server quote
- Pi fee payment
- Confirmed
- Handover
- Active
- Return
- Completed
- Review

### Admin
- Dashboard
- Users
- Listings/Moderation
- Reports/Disputes
- Configuration
- Danger Zone

Keep navigation consistent between desktop header, mobile sidebar, bottom navigation, and footer.

Every visible navigation item must lead somewhere valid or be removed.

Every page must have:

- meaningful loading state
- meaningful empty state
- actionable error state
- recovery path
- no dead-end button

---

# PHASE 10 — LOCALIZATION

Preserve the four supported languages:

- `fa`
- `en`
- `ar`
- `zh`

Do not hard-code new user-facing strings into one language when a localization key should exist.

Maintain correct RTL/LTR behavior.

Verify that new error/loading/status messages are localized.

Do not silently remove existing translations merely to simplify the code.

---

# PHASE 11 — CLEANUP, BUT ONLY AFTER FUNCTIONAL FIXES

After the application is stable, inspect the repository for obsolete artifacts identified by the audit.

Potential cleanup candidates include genuinely unused legacy files/components such as:

- `src/data/mockData.js`
- legacy access-control/verification services if proven unused
- obsolete static/mock HTML artifacts
- old backend entrypoints such as unused `backend/server.js` or root `server.js`
- unused legacy components
- deprecated sync endpoints only when no active consumer requires them

Rules:

1. Prove a file is unused before deletion.
2. Do not delete active Worker entrypoints, schema, migrations, deployment files, security services, tests, or translations.
3. Do not rewrite Git history.
4. Do not delete branches merely because they look old.
5. Do not remove dependencies without proving they are unused.
6. Do not delete `AUDIT_REPORT.md` until the implementation work and verification are complete.
7. Cleanup should be a separate clean commit when practical.

---

# PHASE 12 — TESTING STANDARD

The minimum verification gate is:

```text
npm test
npm run build
node --check worker-gateway.js
node --check worker-entry.js
node --check _worker.js
node --check src/App.jsx
 git diff --check
```

If a script does not apply because of the repository's actual tooling, use the correct equivalent and document it.

Tests must cover both API behavior and user-visible workflows.

At minimum add or update tests for:

1. non-admin cannot access admin overview
2. non-admin cannot modify user status
3. admin can access authorized admin APIs
4. active listing is visible to another user
5. draft listing is not publicly visible
6. deleted listing is not publicly visible
7. owner sees own draft
8. owner cannot rent own listing
9. server calculates payment amount from authoritative listing/rental data
10. client cannot override payment amount
11. payment metadata is bound to the internal intent
12. wrong Pioneer UID is rejected
13. wrong amount is rejected
14. wrong transaction ID is rejected
15. wrong network/status is rejected
16. duplicate completion is idempotently rejected/recovered
17. logout/revocation invalidates the session
18. avatar upload persists in R2/D1
19. public profile receives persisted avatar correctly
20. completed rental unlocks eligible private contact
21. unpaid/cancelled rental does not unlock private contact
22. pre-booking bypass content is blocked
23. authorized post-booking coordination remains possible
24. only eligible rental participants can review
25. duplicate review is rejected
26. direct booking from each supported UI entry point reaches the real booking flow
27. failed API mutation leaves the UI in a non-success state
28. retry/recovery controls actually retry the failed operation

If browser/E2E tooling exists, use it. Otherwise create focused integration tests around the Worker endpoints and state transitions, and manually trace the UI call chain from source.

---

# PHASE 13 — DEPLOYMENT VERIFICATION

After code/tests pass:

1. Build the frontend.
2. Deploy the Cloudflare Worker using the repository's intended configuration.
3. Verify the deployed `/api/health` endpoint.
4. Verify D1/KV/R2 bindings are available.
5. Verify Pi API configuration is present without exposing secrets.
6. Verify `CORS_ORIGIN` and Testnet configuration.
7. Verify public active listings are returned without authentication.
8. Verify authenticated private data remains private.
9. Verify admin endpoint returns 403 to a normal user.
10. Verify the production build does not expose server secrets.
11. Verify the deployed version matches the intended commit.

Never claim deployment success merely because a local build passes.

If actual deployment credentials/access are unavailable, report exactly what was verified and what could not be verified. Do not fabricate runtime results.

---

# PHASE 14 — FINAL AUDIT AND REPORT

Before declaring completion, perform a second read-only audit of the modified system.

Report:

- files changed
- files deleted and why
- database migrations added/changed
- API endpoints added/changed
- authorization rules changed
- payment-flow changes
- listing/rental source-of-truth changes
- avatar/media changes
- navigation/UI changes
- tests added/changed
- exact test/build results
- deployment result
- remaining known limitations

The final report must distinguish:

`verified in code`
`verified by tests`
`verified against deployed runtime`
`not verified`

Do not use a percentage readiness score as a substitute for evidence.

---

# REQUIRED COMMIT DISCIPLINE

Prefer small, understandable commits:

1. `fix: repair verified runtime and navigation failures`
2. `fix: enforce authoritative marketplace and rental state`
3. `fix: harden authorization and session revocation`
4. `fix: persist profile avatars through R2 and D1`
5. `test: cover critical marketplace workflows`
6. `chore: remove obsolete repository artifacts`

If the repository workflow requires a different sequence, keep the commits logically separated.

Do not squash away useful evidence before verification.

---

# DEFINITION OF DONE

Rentora is done for this phase only when all of the following are true:

- Pi Testnet/Sandbox remains the only payment environment.
- No fake login/payment path exists.
- Admin access is server-authorized.
- Sessions can be revoked server-side.
- Active published listings are publicly discoverable.
- Listing prices and rental quotes are server-authoritative.
- Payment intents cannot be manipulated by client-supplied amounts.
- Pi payment identity, metadata, amount, network and status are validated.
- Payment completion is replay-safe and durably represented.
- Rental lifecycle is authoritative in D1.
- Private contact is unlocked only for eligible rentals.
- Chat authorization and anti-bypass behavior remain intact.
- Reviews remain rental-tied and server-authorized.
- Avatar changes persist through R2/D1.
- Direct booking works from all supported entry points.
- No page is left with a dead "restart app" style recovery action.
- Four-language localization remains intact.
- Repository cleanup removes only proven obsolete artifacts.
- Tests pass.
- Production build passes.
- Static syntax and diff checks pass.
- Deployment is actually verified, or the exact verification limitation is documented.
- `AUDIT_REPORT.md` is deleted only after this entire work is complete and verified.

**Important:** Do not stop after fixing the first visible bug. Work through the complete chain above. The objective is a coherent marketplace, not a collection of individually green checkboxes. Humans have suffered enough software that says "success" while doing absolutely nothing.
