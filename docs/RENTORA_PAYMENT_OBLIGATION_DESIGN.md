# Rentora Payment Obligation Design

Status: implementation design
Branch: `docs/project-state-uiux-audit`

## 1. Goal

Replace the current one-payment-per-rental platform-fee model with two server-authoritative platform-fee obligations:

- owner + listing + platform_fee
- renter + rental + platform_fee

The total Rentora platform fee remains the authoritative fee calculated by the server. The two obligations are equal halves.

Example:

`platform_fee_total = 1.0000 PI`
`owner_platform_fee = 0.5000 PI`
`renter_platform_fee = 0.5000 PI`

Rental price and security deposit remain direct P2P amounts. Rentora does not receive, hold, or represent those amounts as treasury revenue.

## 2. Why a separate obligation entity

The current `payment_intents` table has `UNIQUE(rental_id)`, which assumes one payment intent per rental. That is incompatible with independent owner and renter fee payments.

A payment obligation is the durable business object. A Pi payment is only the external payment attempt attached to that obligation.

Each obligation answers:

- who owes the fee
- which listing/rental it belongs to
- why it is owed
- exact server-calculated amount
- current payment state
- Pi payment identifier and transaction identifier
- expiry and idempotency metadata

This prevents the client from selecting an amount, payer, role, rental, or listing.

## 3. Authoritative data model

### 3.1 payment_obligations

Proposed table:

- `id TEXT PRIMARY KEY`
- `rental_id TEXT REFERENCES rentals(id)`
- `listing_id TEXT REFERENCES listings(id)`
- `user_id TEXT NOT NULL REFERENCES users(id)`
- `role TEXT NOT NULL CHECK(role IN ('owner','renter'))`
- `purpose TEXT NOT NULL CHECK(purpose IN ('platform_fee','platform_fee_refund'))`
- `amount REAL NOT NULL CHECK(amount > 0)`
- `currency TEXT NOT NULL DEFAULT 'PI'`
- `status TEXT NOT NULL`
- `pi_payment_id TEXT UNIQUE`
- `pi_txid TEXT UNIQUE`
- `memo TEXT NOT NULL`
- `metadata TEXT`
- `idempotency_key TEXT UNIQUE`
- `expires_at TEXT`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`

For a normal fee obligation, `purpose='platform_fee'`. Refunds are modeled as reversal records or linked refund obligations, not as negative payments.

Recommended status set:

`created -> approved -> completed`

Failure/cancellation states:

`created -> cancelled`
`created -> failed`
`approved -> completed | failed`

A completed obligation is terminal. It must not be silently reused for a different payer, amount, rental, or listing.

## 4. Rental financial fields

Keep the existing rental price/deposit fields for compatibility, but introduce explicit fee fields:

- `platform_fee_total`
- `owner_platform_fee`
- `renter_platform_fee`
- `owner_fee_payment_status`
- `renter_fee_payment_status`
- `owner_fee_payment_id`
- `renter_fee_payment_id`

The existing `platform_fee` becomes a compatibility field during migration. New payment logic must not use it as the single fee authority.

Server invariant:

`platform_fee_total = owner_platform_fee + renter_platform_fee`

For the shared-fee policy:

`owner_platform_fee = renter_platform_fee = platform_fee_total / 2`

Use canonical decimal normalization before persistence and Pi validation. Do not rely on JavaScript floating-point equality.

## 5. Owner fee timing

The owner fee is tied to a listing becoming bookable, not to a generic account/listing creation charge.

Recommended lifecycle:

1. Owner creates a draft listing.
2. Server calculates the owner platform-fee obligation from the listing's authoritative fee configuration.
3. Owner creates and completes the Pi payment.
4. Server verifies the Pi payment and obligation metadata.
5. Listing becomes `active` and bookable only after verified owner-fee completion.

A listing must never be advertised as bookable while its owner fee is unresolved.

If the product later changes the fee at listing activation, a new authoritative obligation must be generated. The client never supplies the fee.

## 6. Renter fee timing

The renter fee is created only after an authoritative rental reservation has been created.

Recommended lifecycle:

1. Server validates dates and listing availability.
2. Server calculates the rental economics and shared platform fee.
3. Server creates the rental in a pending state.
4. Server creates the renter platform-fee obligation.
5. Renter pays that exact obligation through Pi.
6. Server verifies payer, amount, metadata, and Pi status.
7. Rental becomes confirmed only when all required fee conditions are satisfied.

The rental price and security deposit are not sent to the Rentora payment obligation.

## 7. Pi metadata binding

Every Pi payment created for a platform-fee obligation must carry server-generated metadata equivalent to:

- `obligationId`
- `rentalId` when applicable
- `listingId`
- `payerUserId`
- `payerPiUid`
- `role`
- `purpose`
- `amount`
- `currency`

The server must validate the Pi payment against D1 and reject:

- wrong obligation
- wrong payer
- wrong role
- wrong listing
- wrong rental
- wrong amount
- wrong currency
- reused Pi payment ID
- reused completed obligation
- mismatched metadata

The browser must not be trusted for any of these values.

## 8. Idempotency

Payment intent creation must be idempotent per obligation and request.

Preferred key:

`payment_obligation_id + authenticated_user + operation`

Repeated requests return the existing valid obligation/payment intent instead of creating a second economic obligation.

Pi payment IDs remain globally unique.

A successful Pi completion must be recorded exactly once in D1. Retried completion calls may return the already-completed authoritative result.

## 9. Existing payment_intents compatibility

Do not delete `payment_intents` immediately.

Migration sequence:

1. Add `payment_obligations`.
2. Add explicit rental fee split fields.
3. Backfill current valid platform-fee payments into renter obligations only where the historical payer is unambiguous.
4. Keep `payment_intents` readable for legacy records.
5. New payment routes write `payment_obligations` as the source of truth.
6. New transaction records reference the obligation.
7. After all legacy callers are migrated and production data is reconciled, `payment_intents` can become legacy-only.

Do not reinterpret old payments as owner payments merely because the new model requires an owner share.

## 10. Transactions and treasury

Transactions should be extended with:

- `rental_id`
- `listing_id`
- `payment_obligation_id`
- `fee_role`
- `purpose`
- `related_transaction_id`

Suggested values:

`fee_role = owner | renter | null`

`purpose = platform_fee | platform_fee_refund | admin_payout`

Treasury revenue is the sum of completed platform-fee transactions only.

Rental price and deposit never enter this revenue calculation.

Admin payouts remain separate A2U operations and must not be confused with fee collection or refunds.

## 11. Refund architecture

A refund is a real reversal of a completed platform-fee payment.

Requirements:

- no synthetic transaction ID
- no fake balance increase
- idempotent refund operation
- original Pi payment must be identifiable
- D1 records the refund relationship
- uncertain Pi state enters reconciliation
- admin resolution cannot manufacture a successful Pi refund

For a deterministic owner-caused non-delivery outcome:

- renter fee: refundable
- owner fee: retained
- owner reliability incident recorded

For mutual cancellation or a validated exception:

- both completed platform-fee payments are refundable

For renter-caused no-show:

- both fees are retained

For unresolved cases:

- no automatic refund until resolution

These are the current lifecycle-spec baseline and must be implemented as server-side outcomes, not UI-only labels.

## 12. Listing gate

Introduce an authoritative owner-fee gate without changing the meaning of `listings.status` prematurely.

A listing is bookable only if:

- listing status is active
- owner is active
- owner platform-fee obligation is completed/verified

Recommended query logic should derive bookability from these authoritative conditions.

Do not make a client-side `isActive` flag authoritative.

## 13. Contact unlock

Private contact remains locked until the renter's rental is confirmed under the new fee model.

The unlock predicate should require:

- authenticated renter is the rental renter
- rental is confirmed/active/completed according to existing policy
- renter fee obligation is completed
- owner fee obligation is completed/verified

This prevents contact disclosure when only one side has paid.

## 14. Indexes and constraints

Required indexes:

- `payment_obligations(rental_id)`
- `payment_obligations(listing_id)`
- `payment_obligations(user_id, status)`
- `payment_obligations(pi_payment_id)`
- `payment_obligations(role, purpose, status)`
- `transactions(payment_obligation_id)`
- `transactions(rental_id)`

Useful uniqueness constraints:

- one active/completed owner platform-fee obligation per listing activation cycle
- one renter platform-fee obligation per rental
- one Pi payment per obligation

Because SQLite/D1 partial unique indexes may be used carefully, the migration must encode the exact supported lifecycle rather than relying on application-only uniqueness.

## 15. API contract

Preferred new contract:

### Owner

`POST /api/listings/:id/owner-fee/intent`

Server verifies listing ownership and computes the amount.

`POST /api/listings/:id/owner-fee/complete`

Server verifies the Pi payment against the obligation.

### Renter

`POST /api/rentals/:id/fees/intent`

Server returns the renter obligation and exact amount.

`POST /api/rentals/:id/fees/complete`

Server verifies and records completion.

Existing generic payment code can be refactored internally to a shared obligation service so Pi validation remains centralized.

## 16. State invariants

The implementation must enforce:

1. Client never chooses a fee amount.
2. Client never chooses fee role.
3. Client never chooses payer.
4. Owner obligation cannot be paid by renter.
5. Renter obligation cannot be paid by owner.
6. Owner obligation cannot be attached to another listing.
7. Renter obligation cannot be attached to another rental.
8. Completed obligations cannot be mutated into a different obligation.
9. Rental confirmation requires required fee completion.
10. Bookable listing requires verified owner fee.
11. Rental/deposit money never becomes Rentora treasury revenue.
12. Refunds never create synthetic Pi transactions.
13. Every economic state change is auditable.
14. Repeated callbacks are idempotent.

## 17. Migration and rollback

Migration must be additive first.

Phase A:
- create obligation table
- add nullable rental fee split fields
- add transaction linkage fields
- add indexes
- add compatibility helpers

Phase B:
- backfill and reconcile existing records
- deploy read paths that understand both models

Phase C:
- switch new owner/renter fee creation to obligations
- keep old payment intent reads for legacy records

Phase D:
- switch treasury and contact-unlock predicates to obligations

Phase E:
- remove legacy write paths after production verification

Rollback principle:

If application rollback is required, existing legacy payment records remain intact. New obligation records must not be destroyed by rollback. No migration should rewrite historical Pi transaction identity.

## 18. Test matrix

Before UI migration, automated tests must cover:

- owner fee calculated server-side
- renter fee calculated server-side
- exact 50/50 split
- minimum fee handling
- wrong payer rejected
- wrong amount rejected
- wrong listing rejected
- wrong rental rejected
- wrong obligation rejected
- duplicate intent is idempotent
- duplicate completion is idempotent
- duplicate Pi payment rejected
- listing blocked before owner fee completion
- listing becomes bookable after verified owner fee
- rental remains unconfirmed before required renter fee
- rental confirms after required obligations
- contact remains locked before confirmation
- contact unlocks only after confirmation
- completed fee appears once in treasury
- rental price never appears as treasury revenue
- refund is idempotent
- refund uncertainty enters reconciliation
- legacy payment_intents remain readable
- existing A2U payout tests remain green

## 19. Implementation order

1. Add migration `0012_payment_obligations.sql`.
2. Add authoritative fee-split helpers.
3. Add obligation repository/service functions.
4. Refactor Pi payment validation to accept an obligation.
5. Implement owner fee intent/complete.
6. Implement renter fee intent/complete.
7. Update rental confirmation and contact gates.
8. Add transaction linkage and treasury classification.
9. Add refund/reconciliation primitives.
10. Add lifecycle/reliability hooks.
11. Run the full test suite.
12. Deploy to Pi Testnet only after tests and schema verification pass.
13. Validate real owner payment, real renter payment, cancellation/refund paths, and reconciliation.
14. Only then migrate the new UI to these contracts.

## 20. Explicit non-goals

This migration does not:

- create a Rentora wallet for users
- move rental price or deposit into Rentora custody
- fabricate balances
- simulate Pi payments
- rebuild Pi authentication
- replace the existing A2U payout system
- redesign the UI
- remove the legacy UI before real-backend validation

The backend remains the foundation. This change makes the fee model explicit enough for the new UX to represent it truthfully.
