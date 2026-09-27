# Rentora Rental Lifecycle Specification v0.1

Date: 2026-09-25
Branch: docs/project-state-uiux-audit
Status: Product specification baseline. No implementation started.

## 1. Purpose

This document turns the approved 50/50 platform-fee model and Trust & Reliability research into one operational rental lifecycle.

Core financial boundary:

- Rentora platform fee = 50% owner + 50% renter.
- Rental price and security deposit are direct P2P amounts.
- Rentora never holds the rental price or security deposit.
- Every fee amount, payment state, reservation state and reliability outcome is server-authoritative.
- A user report is an allegation until the lifecycle evidence establishes an outcome.

The specification intentionally extends the existing rental state machine instead of replacing it.

## 2. Actors

- Owner: publishes the item and is responsible for availability and agreed handover.
- Renter: reserves the item and is responsible for payment of the renter platform fee, coordination and attendance.
- Rentora: authenticates users, records the reservation, collects its platform fee, unlocks contact at the defined point, records lifecycle events, handles disputes and applies approved reliability actions.
- Admin: resolves ambiguous or exceptional cases and authorizes policy-driven financial/reliability outcomes.

## 3. Money model

For a rental with platform fee T:

- Owner platform fee = T / 2
- Renter platform fee = T / 2
- Rental price = direct owner↔renter payment
- Security deposit = direct owner↔renter payment
- Rentora revenue = the two platform-fee payments only

The UI must show these as separate lines. Never present rental price + deposit + Rentora fee as one amount paid to Rentora.

Suggested wording:

«کارمزد Rentora بین موجر و مستأجر به‌طور مساوی تقسیم می‌شود.»

«Rentora مبلغ اجاره و ودیعه را دریافت یا نگهداری نمی‌کند؛ این مبالغ مستقیماً بین موجر و مستأجر تسویه می‌شوند.»

## 4. Lifecycle states

The existing states remain the persistence-compatible foundation:

- requested
- accepted
- payment_pending
- confirmed
- active
- completed
- rejected
- cancelled
- disputed

The product lifecycle adds operational sub-states/events rather than forcing every operational condition into a top-level rental state.

Canonical lifecycle:

DRAFT
→ OWNER_FEE_PENDING
→ LISTING_ACTIVE
→ REQUESTED
→ RENTER_FEE_PENDING
→ CONFIRMED
→ COORDINATING
→ HANDOVER_DUE
→ ACTIVE
→ RETURN_DUE
→ COMPLETED

Failure paths can branch from the relevant stage into CANCELLED or DISPUTED, with a separate resolution outcome.

## 5. Owner fee commitment

### Trigger

The owner pays their 50% platform-fee share when the listing is activated/published for booking.

This is a real Pi payment. It is not a fake listing balance and is not a wallet deposit.

### Why

The owner has a financial commitment before accepting a renter. This is intended to reduce casual or unreliable supply while keeping the fee symmetric with the renter's later share.

### Listing activation rule

A listing cannot become bookable until:

- server has calculated the authoritative owner fee;
- an owner fee payment intent exists;
- Pi payment is completed and verified by the server;
- payment is idempotently recorded.

If the owner abandons payment, the listing remains unpublished/inactive.

### Important accounting rule

The owner fee is a platform fee, not a rental-price deposit. It is not held as escrow and is not transferred to the renter.

## 6. Renter reservation

The renter selects dates and creates a server-authoritative quote.

Server determines:

- rental dates
- rental price
- security deposit
- total platform fee
- owner fee
- renter fee
- applicable availability
- reservation identifiers

The client cannot choose or override these values.

A reservation is not confirmed merely because a client started Pi payment.

## 7. Renter fee

The renter pays their 50% platform-fee share after the reservation is created and before confirmation.

Required sequence:

1. server creates reservation;
2. server creates/returns renter payment intent;
3. client creates Pi payment;
4. server verifies payment with Pi Platform API;
5. server binds payment to rental, payer and exact amount;
6. reservation becomes confirmed only when all required fee conditions are satisfied.

The renter does not pay the rental price or security deposit to Rentora.

## 8. Contact unlock

Private owner contact information is unlocked only after the reservation reaches the defined paid/confirmed state.

Before unlock:

- renter can see public listing information;
- renter cannot access private contact details.

After unlock:

- renter and owner can coordinate handover;
- contact-access event is recorded.

Contact access is an operational event, not proof that handover occurred.

## 9. Coordination

Once confirmed:

- both parties see the agreed handover date/time;
- the system provides contextual reminders;
- messages/contact remain available;
- the listing's affected dates are locked from conflicting reservations.

The UI should show the concrete date/time, not a generic promise such as "within 24 hours."

Recommended event sequence:

CONFIRMED
→ COORDINATING
→ HANDOVER_DUE

The exact reminder intervals can be configuration values, but the handover deadline is always derived from the actual reservation.

## 10. Handover

At the agreed handover point, both parties get a clear action:

«کالا تحویل شد»

and, when necessary:

«مشکل در تحویل»

Successful handover should require confirmation from either party according to the existing handover architecture, with the event recorded.

Handover event records:

- rental ID
- actor
- timestamp
- event type
- rental state
- relevant payment state
- optional note/evidence reference

Normal successful handover should remain low-friction. Evidence should not be mandatory for every successful rental.

## 11. Owner non-delivery

The renter can report a non-delivery issue only once the handover is due or the configured issue-reporting threshold has been reached.

Initial issue choices:

- مالک حاضر نشد
- کالا موجود نبود
- مالک پاسخ نمی‌دهد
- زمان/مکان تحویل تغییر کرده بود
- مشکل دیگر

The report records facts first and blame second.

After submission:

CONFIRMED/HANDOVER_DUE
→ DISPUTED (operational issue open)

The other party is notified and receives a response window.

A report alone must not trigger punishment.

## 12. Owner response

The owner can respond with:

- handover completed;
- renter did not attend;
- mutually agreed cancellation;
- emergency/exception;
- factual explanation and evidence.

The system preserves both sides' event histories.

Clear cases can be resolved automatically only when authoritative events make the outcome sufficiently unambiguous. Ambiguous cases go to admin review.

## 13. Renter no-show

If the owner reports that the renter failed to attend the agreed handover, the system records:

- scheduled handover time;
- owner's handover confirmation/attendance event;
- renter response;
- coordination messages where available.

The renter is given a response window.

A renter no-show is not established solely because the owner pressed a button. It becomes confirmed only through the defined evidence/resolution process.

## 14. Mutual cancellation

If both parties explicitly agree to cancel before successful handover:

- rental becomes CANCELLED;
- direct P2P rental/deposit settlement is expected not to have occurred through Rentora;
- platform-fee outcome follows the cancellation policy below;
- no reliability incident is assigned to either party unless there is evidence of separate misconduct.

## 15. Cancellation policy baseline

### Before renter fee is paid

The reservation can be cancelled without a platform-fee refund because the renter fee has not yet been collected.

### After both fee payments, before handover

Cancellation outcome depends on responsibility:

| Outcome | Owner fee | Renter fee | Reliability |
|---|---|---|---|
| Owner responsible | refund | refund | owner incident |
| Renter responsible | retained | retained | renter incident |
| Mutual agreement | refund | refund | no incident |
| Valid documented exception | refund | refund | no incident |
| Unresolved | pending | pending | admin review |

Refund here means a real platform-fee refund operation, not a database balance adjustment.

## 16. No-show policy baseline

### Owner no-show / non-delivery confirmed

- renter platform fee: refund;
- owner platform fee: retained for the affected incident;
- listing: temporarily unavailable for the affected dates until resolved;
- owner reliability incident: recorded;
- repeated incidents: progressive restriction.

The retained owner fee is a platform consequence, not money transferred to the renter. If a future policy chooses compensation to the renter, that must be implemented as a separate explicit platform operation and must not be described as escrow.

### Renter no-show confirmed

- renter platform fee: retained;
- owner platform fee: retained;
- renter reliability incident: recorded;
- repeated incidents: progressive restriction.

### Mutual no-show / unresolved facts

- no automatic punishment;
- platform-fee outcome remains pending;
- admin review decides the final outcome.

## 17. Emergency / documented exception

An emergency is not a universal escape hatch.

Examples may include a documented event that genuinely prevents handover and is outside the party's reasonable control.

If accepted:

- platform-fee payments are refunded;
- no reliability incident is assigned;
- affected dates may remain temporarily unavailable while the listing is revalidated.

Admin can request evidence when the event cannot be verified from system events.

## 18. Dispute resolution

Disputed cases contain:

- rental timeline;
- payment states;
- handover time;
- both parties' responses;
- relevant messages;
- contact-access event;
- submitted evidence;
- previous confirmed incidents;
- proposed resolution.

Admin decision outcomes:

- OWNER_RESPONSIBLE
- RENTER_RESPONSIBLE
- MUTUAL_CANCELLATION
- VALID_EXCEPTION
- INSUFFICIENT_EVIDENCE

Every admin decision must include:

- decision
- reason
- timestamp
- admin identity
- resulting financial action
- resulting reliability action

## 19. Refund architecture

Refunds are platform-fee operations only.

They must:

- reference the original Pi payment;
- be idempotent;
- be recorded in D1;
- have a reconciliation state;
- never fabricate a transaction ID;
- be visible in Admin Treasury/Transactions;
- distinguish refund from payout.

Automatic refund is allowed only for deterministic outcomes with strong authoritative evidence.

Admin approval is required for ambiguous outcomes.

Rentora must never create a fake "refund balance" in the user's account.

## 20. Reliability consequences

Confirmed incidents are progressive.

Baseline:

1. First confirmed failure: incident recorded + user notification.
2. Repeated confirmed failures: temporary booking/listing restriction.
3. Continued confirmed failures: stronger restriction + admin review.
4. Severe/repeated abuse: suspension according to platform policy.

Allegations do not count as confirmed incidents.

Owner and renter incidents are tracked separately. Their consequences do not have to be identical because the underlying failure modes are different.

No public score is introduced at this stage.

## 21. Listing availability

When an owner-caused non-delivery is confirmed:

- affected dates are blocked;
- the listing may be temporarily unavailable;
- new bookings are prevented until the issue is resolved or the owner reconfirms availability.

The listing is not deleted automatically.

## 22. Return and completion

After successful handover:

CONFIRMED
→ ACTIVE

At the rental end:

ACTIVE
→ RETURN_DUE
→ COMPLETED

Return confirmation should follow the existing owner-side completion model unless the backend audit proves that both-party confirmation is required.

Completion records the final lifecycle event and closes the normal reliability window.

## 23. Canonical event model

The new implementation should prefer append-only lifecycle events over scattered booleans.

Conceptual event types:

- OWNER_FEE_INTENT_CREATED
- OWNER_FEE_PAID
- LISTING_ACTIVATED
- RENTAL_CREATED
- RENTER_FEE_INTENT_CREATED
- RENTER_FEE_PAID
- RENTAL_CONFIRMED
- CONTACT_UNLOCKED
- HANDOVER_REMINDER_SENT
- HANDOVER_DUE
- HANDOVER_CONFIRMED
- NON_DELIVERY_REPORTED
- OWNER_NO_SHOW_REPORTED
- RENTER_NO_SHOW_REPORTED
- CANCELLATION_REQUESTED
- CANCELLATION_CONFIRMED
- EMERGENCY_REPORTED
- DISPUTE_OPENED
- DISPUTE_RESPONDED
- ADMIN_DECISION_RECORDED
- PLATFORM_FEE_REFUND_REQUESTED
- PLATFORM_FEE_REFUNDED
- LISTING_RESTRICTED
- LISTING_RESTORED
- RENTAL_COMPLETED

Events are immutable audit records. Current state can be derived/maintained from them, but the event history remains authoritative for dispute investigation.

## 24. Required server-authoritative financial fields

The implementation should converge on:

- platform_fee_total
- owner_platform_fee
- renter_platform_fee
- owner_fee_payment_status
- renter_fee_payment_status
- owner_fee_payment_id
- renter_fee_payment_id
- fee_refund_status
- fee_refund_amount
- fee_refund_payment_id

Amounts must use canonical decimal handling.

The client must never supply the authoritative fee amount to payment intent creation.

## 25. UX requirements

Every lifecycle screen must answer five things immediately:

1. الان چه وضعیتی دارد؟
2. چه کسی باید کاری انجام دهد؟
3. کار بعدی چیست؟
4. تا چه زمانی؟
5. چه مبلغی واقعاً به Rentora پرداخت شده یا خواهد شد؟

Financial UI must visually separate:

- اجاره
- ودیعه
- کارمزد موجر
- کارمزد مستأجر
- مبالغی که Rentora نگهداری نمی‌کند

The timeline is the primary trust surface.

## 26. Admin requirements

Admin Rental Incident view must show:

- rental
- owner
- renter
- listing
- dates
- platform fee amounts
- payment verification
- contact unlock
- handover events
- cancellation events
- messages/evidence
- prior confirmed incidents
- current restriction
- decision
- refund operation
- audit trail

Treasury must show fee refunds as real financial operations, not adjustments to an invented user balance.

## 27. Implementation guardrails

No implementation should:

- move rental price or security deposit into Rentora escrow;
- trust client-provided fee amounts;
- treat a report as proof;
- automatically punish on an allegation;
- create synthetic Pi transaction IDs;
- expose private contact before the required payment/confirmation state;
- keep authoritative payment state only in localStorage;
- replace the existing backend architecture wholesale.

The existing Pi auth, payment verification, D1/KV, rental state machine, payout/reconciliation and security architecture remain the foundation.

## 28. Next implementation order

1. Audit current owner-listing activation and Pi payment endpoints.
2. Define the smallest D1 schema extension for owner fee + renter fee + lifecycle events.
3. Implement server-authoritative owner-fee activation.
4. Implement server-authoritative renter-fee reservation.
5. Implement contact unlock gating.
6. Implement lifecycle event recording.
7. Implement handover confirmation and issue reporting.
8. Implement deterministic cancellation/refund paths.
9. Implement dispute/admin resolution.
10. Implement reliability restrictions.
11. Add automated tests for every lifecycle branch.
12. Only after backend behavior is validated, design the Booking/Activity/Admin flows in Figma and migrate the UI.

## 29. Product decision summary

The intended Rentora lifecycle is:

Owner activates listing
→ Owner pays 50% platform fee
→ Listing becomes bookable
→ Renter creates reservation
→ Renter pays 50% platform fee
→ Reservation confirmed
→ Private contact unlocked
→ Coordination
→ Handover
→ Active rental
→ Return
→ Completed

Failure path:

Handover due
→ issue reported
→ both sides respond
→ deterministic resolution or admin review
→ platform-fee refund/retention
→ reliability consequence
→ listing restriction/restoration when applicable

This is the product baseline for the next technical audit. No Figma or UI implementation should begin until the existing backend endpoints are mapped to these states and any capability gaps are identified.
