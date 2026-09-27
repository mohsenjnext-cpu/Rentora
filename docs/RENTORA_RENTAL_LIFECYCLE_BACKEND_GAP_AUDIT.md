# Rentora Rental Lifecycle Backend Gap Audit v0.1

Date: 2026-09-25
Branch: docs/project-state-uiux-audit
Status: Audit only. No production code changed.

## 1. Scope

Compared the Rental Lifecycle Specification v0.1 against the current main-branch backend, D1 schema, payment service and contact-unlock flow.

Conclusion: the current architecture is a solid foundation for the lifecycle, but the approved 50/50 fee model is NOT implemented yet. The current backend still represents one platform fee attached to the renter's rental/payment flow.

No UI/Figma implementation should begin for the new lifecycle until the financial contract is corrected.

## 2. Current implementation that can be reused

### Authentication and server authority

Existing Pi authentication and server session model can remain.

- Pi identity is verified server-side.
- D1 is the marketplace source of truth.
- KV stores sessions/idempotency state.
- Payment intent amount is read from D1 rather than trusted from the browser.
- Pi payment identity, metadata, amount and network are validated server-side.

This part should not be rebuilt.

### Rental quote / reservation

The current architecture already has:

- authoritative server-side quote calculation;
- rental creation;
- overlap protection;
- payment intent creation;
- Pi approve/complete verification;
- incomplete payment handling.

These are reusable foundations.

### Contact unlock

Current endpoint:

GET /api/rentals/:id/contact

Already requires the renter to have:

- payment_status = completed
- rental state in confirmed/active/completed

This is directionally correct, but its payment gate currently represents the single renter-side platform fee. Under 50/50, the gate must represent the required reservation payment conditions, not merely one generic payment_status.

### Treasury / payout

The treasury already distinguishes:

- completed platform-fee revenue
- admin payout
- payout reservations
- reconciliation-required states

This can support the future owner+renter fee accounting and refund operations.

## 3. Critical gap: one fee instead of two

Current rental representation exposes:

- platform_fee
- total_amount
- payment_status

Current payment intent creation reads:

- rentals.platform_fee

The payment intent is associated with:

- rental
- renter user
- one payment_intent row

There is no authoritative owner fee field and no owner fee payment state.

Therefore the current model cannot represent:

- owner_platform_fee
- renter_platform_fee
- owner_fee_payment_status
- renter_fee_payment_status
- owner_fee_payment_id
- renter_fee_payment_id

This is the primary backend blocker.

## 4. Critical gap: owner activation is not fee-gated

Current listings schema supports:

- draft
- active
- paused
- deleted

But there is no owner platform-fee payment state attached to a listing or owner reservation commitment.

The lifecycle specification requires:

OWNER_FEE_PENDING
→ OWNER_FEE_PAID
→ LISTING_ACTIVE

The current system can activate a listing without proving that its owner fee has been paid.

This must be changed before the 50/50 model is considered real.

## 5. Critical gap: current fee calculation is renter-only

Current authoritative financial calculation produces one:

platformFee = baseRentalAmount × feeRate

The current default rate is 5%.

The new model needs:

platformFeeTotal = baseRentalAmount × feeRate
ownerPlatformFee = platformFeeTotal / 2
renterPlatformFee = platformFeeTotal / 2

The split must be canonical and persisted server-side.

The browser must receive the resulting values but never supply them as authority.

## 6. Critical gap: payment intent uniqueness

Current payment_intents has:

UNIQUE(rental_id)

That schema is correct for one payment per rental but incompatible with two independent fee payments.

The new architecture needs either:

A. separate payment-intent records linked to a fee role, or
B. a generalized payment obligations table.

Preferred design:

payment_obligations

- id
- rental_id nullable for owner listing activation / required owner commitment
- listing_id nullable
- user_id
- role: owner | renter
- purpose: platform_fee
- amount
- currency
- status
- pi_payment_id
- pi_txid
- memo
- metadata
- expires_at
- created_at
- updated_at

Then the existing payment_intents table can be retained for compatibility or migrated deliberately.

The important requirement is that the database can represent two independent obligations without ambiguity.

## 7. Critical gap: transactions need role/rental linkage

Current transactions already have:

- user_id
- amount
- type
- payment_intent_id
- Pi payment identifiers

But the new model requires reliable reporting of:

- which rental/listing;
- which party;
- which fee obligation;
- whether the transaction is owner fee or renter fee.

Recommended additions:

- rental_id nullable
- listing_id nullable
- fee_role: owner | renter
- purpose: platform_fee | platform_fee_refund
- related_transaction_id for refunds

This prevents treasury from having to infer business meaning from user IDs or generic transaction type.

## 8. Critical gap: refund model does not exist for platform fees

Current payout infrastructure is designed for app-to-user payout / treasury withdrawal.

That is not the same as a platform-fee refund.

The lifecycle requires real platform-fee refunds.

Refund architecture must be added separately and must:

- reference original Pi payment;
- be idempotent;
- verify original payment;
- record refund state;
- preserve original payment ID;
- preserve actual blockchain transaction ID when available;
- support reconciliation;
- appear in treasury;
- never create a synthetic user balance.

Do not reuse admin payout semantics as a refund.

## 9. Critical gap: lifecycle events do not exist as a first-class model

Current rental status exists, but the specification needs an append-only event history for:

- fee payments
- confirmation
- contact unlock
- reminders
- handover due
- handover confirmation
- non-delivery report
- no-show report
- cancellation
- dispute
- admin decision
- refund
- restriction

Recommended table:

rental_events

- id
- rental_id
- event_type
- actor_user_id nullable
- actor_role
- event_time
- metadata
- created_at

Events should be immutable.

The rental status remains the current state; events provide the evidence timeline.

## 10. Critical gap: handover is not a first-class operation

Current state machine has CONFIRMED → ACTIVE through handover-related logic, but the lifecycle needs explicit events/actions:

- HANDOVER_DUE
- HANDOVER_CONFIRMED
- NON_DELIVERY_REPORTED
- OWNER_NO_SHOW_REPORTED
- RENTER_NO_SHOW_REPORTED

The UI should not invent these events locally.

The Worker must authorize them and record them in D1.

## 11. Critical gap: reports are too generic

Current reports table is generic:

- reporter
- target_type
- target_id
- reason
- status
- metadata

This can remain for general reports, but rental incidents need structured fields or a dedicated incident table.

Recommended:

rental_incidents

- id
- rental_id
- reporter_user_id
- issue_type
- status
- response_deadline
- response_from_owner
- response_from_renter
- evidence_metadata
- resolution
- resolution_reason
- resolved_by
- resolved_at
- created_at
- updated_at

The generic reports table can reference the incident when needed.

## 12. Critical gap: listing restriction needs lifecycle linkage

Current listing status can be:

active / paused / deleted / draft.

The new reliability system needs to distinguish:

- ordinary owner pause;
- temporary restriction after confirmed non-delivery;
- admin restriction;
- restored listing.

A full new listing state is not necessarily required. A restriction record can be safer:

listing_restrictions

- id
- listing_id
- reason
- source_rental_id
- status
- starts_at
- ends_at nullable
- created_by
- resolved_by
- created_at
- updated_at

The booking query must reject listings with an active restriction.

## 13. Current contact unlock needs refinement

Current renter access rule:

payment_status = completed
AND rental status in confirmed/active/completed

New rule should become conceptually:

rental confirmed
AND renter fee completed
AND required owner fee condition satisfied

The exact owner-fee timing matters.

Recommended rule:

- owner fee must already be paid before listing can be bookable;
- renter fee must be completed before reservation confirmation;
- contact unlock occurs only after reservation confirmation.

This makes the state easy to reason about and avoids exposing owner contact for an unconfirmed reservation.

## 14. Current messaging model is reusable

Current conversations already distinguish:

- pre_booking
- post_booking

and post-booking unlock is tied to the rental payment/confirmed state.

This can remain, but its unlock predicate must be updated to the new authoritative reservation confirmation condition.

Pre-booking anti-bypass filtering should remain.

## 15. Recommended target architecture

Instead of modifying every existing payment table in place immediately, introduce an explicit concept:

Payment Obligation

A payment obligation answers:

Who owes?
What do they owe?
Why?
For which listing/rental?
How much?
Which Pi payment satisfies it?
What is its state?

Example:

OWNER + LISTING + PLATFORM_FEE = 0.5 Pi
RENTER + RENTAL + PLATFORM_FEE = 0.5 Pi

Then the existing Pi payment verification machinery consumes the obligation.

This keeps the business model clear and prevents another generation of "platform_fee means whatever this endpoint happened to need."

## 16. Recommended migration sequence

Migration A: payment obligations

Add a generalized obligation model for owner/renter platform fees.

Migration B: rental financial split

Add:

- platform_fee_total
- owner_platform_fee
- renter_platform_fee
- owner_fee_payment_status
- renter_fee_payment_status

Keep existing platform_fee temporarily as a compatibility field mapped to the renter fee only during migration, then remove its authority.

Migration C: transaction linkage

Add fee role and rental/listing linkage.

Migration D: lifecycle events

Add rental_events.

Migration E: incidents/reliability

Add rental_incidents and listing restrictions.

Migration F: refunds

Add platform fee refund/reconciliation records.

Only after all migrations are deployed should the API behavior switch to the new model.

## 17. API changes required

New/changed server contracts should include:

### Owner fee

POST /api/listings/:id/owner-fee/intent

Server calculates the owner's fee and creates the obligation.

POST /api/listings/:id/owner-fee/approve

POST /api/listings/:id/owner-fee/complete

Listing becomes bookable only after verified completion.

### Renter fee

Existing:

POST /api/payments/intent

must become obligation-aware and must not assume one renter-only platform fee.

Prefer:

POST /api/rentals/:id/fees/intent

with role inferred from authenticated user and server-side obligation.

### Lifecycle

POST /api/rentals/:id/handover

POST /api/rentals/:id/issues

POST /api/rentals/:id/cancel

POST /api/rentals/:id/resolve-response

These are conceptual contracts and must be reconciled with existing routes before implementation.

### Admin

Add structured incident resolution and refund operations instead of overloading generic report status.

## 18. What does NOT need rebuilding

Do not replace:

- Pi authentication
- Pi SDK integration
- Pi API verification
- D1/KV architecture
- payout_operations
- existing overlap protection
- existing conversation system
- anti-bypass messaging filter
- existing admin authorization
- current security headers/CORS/session architecture

The goal is a targeted extension, not another backend rewrite.

## 19. Current readiness assessment

For the newly approved lifecycle:

| Capability | Current state | Action |
|---|---|---|
| Server-authoritative rental quote | Present | Reuse |
| Server-authoritative renter payment | Present | Refactor into obligation |
| Owner fee payment | Missing | Implement |
| 50/50 fee split | Missing | Implement |
| Two fee states | Missing | Implement |
| Contact unlock | Present, renter-payment based | Refine |
| Rental overlap protection | Present | Reuse |
| Handover event model | Partial | Implement |
| Non-delivery incident model | Missing | Implement |
| No-show model | Missing | Implement |
| Lifecycle event log | Missing | Implement |
| Platform-fee refund | Missing | Implement |
| Treasury payout | Present | Reuse |
| Refund reconciliation | Missing | Implement |
| Progressive reliability restrictions | Missing | Implement |
| Admin generic report status | Present | Extend with incident resolution |

## 20. Implementation gate

The lifecycle backend should not be called complete until these acceptance tests pass:

1. Owner cannot activate a bookable listing without verified owner-fee payment.
2. Owner fee amount is server-calculated.
3. Renter fee amount is server-calculated.
4. Owner and renter obligations cannot be swapped.
5. A Pi payment from the wrong user is rejected.
6. A Pi payment with the wrong amount is rejected.
7. A payment for the wrong listing/rental is rejected.
8. Reservation confirmation requires the required fee conditions.
9. Contact remains locked before confirmation.
10. Contact unlocks after confirmation.
11. Handover confirmation creates an immutable event.
12. Non-delivery report creates an incident, not an automatic punishment.
13. Other party can respond.
14. Deterministic owner-caused non-delivery produces the approved refund outcome.
15. Refund cannot be duplicated.
16. Refund reconciliation handles uncertain Pi state.
17. Confirmed reliability incidents create the appropriate restriction.
18. Unverified allegations do not create punishment.
19. Rental price and security deposit never enter Rentora treasury.
20. Existing Pi payment and payout tests remain green.

## 21. Audit conclusion

The current Rentora backend is not a dead end. Most of the difficult infrastructure is already there.

The actual blocker is narrower and very concrete:

The database and payment model currently understand "one platform fee for a rental paid by the renter." The approved product now requires "two independent platform-fee obligations, one for each party, with separate payment states, lifecycle events and refund outcomes."

Therefore the next engineering step should be the payment-obligation/data-model migration design, followed by implementation and tests.

No visual redesign should encode the new 50/50 flow until these server contracts exist.
