# Rentora Shared Platform Fee Model v0.1

Date: 2026-09-25
Branch: docs/project-state-uiux-audit
Status: Product decision / research baseline. No implementation started.

## 1. Decision

Rentora platform fee for a rental is split equally between the owner (موجر) and renter (مستأجر).

Example:
- Total Rentora platform fee: 1 Pi
- Owner share: 0.5 Pi
- Renter share: 0.5 Pi

This replaces the previous product direction where the renter alone paid the Rentora platform fee.

## 2. Why this model

The goal is shared commitment and balanced incentives.

The renter already takes the risk of making a reservation before receiving the owner's private contact details. Requiring the owner to contribute an equal share of the platform fee means the owner also has a financial stake in completing the agreed handover.

The product message should be simple: the fee is shared equally between both parties to support a more committed and trustworthy rental process.

This is a product rationale, not a guarantee that payment of a fee will prevent non-delivery.

## 3. Financial boundaries

Rentora remains a non-escrow P2P marketplace.

The following are separate concepts and must remain visually and technically distinct:
- Rental price: paid directly between renter and owner.
- Security deposit: paid/settled directly between renter and owner.
- Rentora platform fee: paid to Rentora and split 50/50 between owner and renter.
- Rentora does not hold the rental price or security deposit as user funds.

The UI must never imply that Rentora is holding the rental amount or deposit.

## 4. Proposed rental payment lifecycle

1. Owner creates or activates a listing.
2. The system calculates the applicable platform fee using the authoritative server configuration.
3. The owner's share is calculated as 50% of the total platform fee for the rental.
4. The listing is eligible for reservation only when the owner's required fee state is satisfied according to the final lifecycle rules.
5. Renter selects the rental dates and creates a server-authoritative reservation.
6. Renter pays their 50% share through the Pi payment flow.
7. Reservation becomes confirmed only after the required payment state is verified.
8. Private owner contact information becomes available according to the existing post-payment access policy.
9. Parties coordinate handover.
10. Handover, cancellation, no-show and non-delivery outcomes are recorded as rental lifecycle events.

The exact point at which the owner payment is collected must be finalized during implementation design. The important product requirement is that the owner's share is tied to the reservation economics, not treated as an unrelated generic listing fee.

## 5. Authoritative financial fields

The existing server-authoritative payment architecture must be extended rather than replaced.

Conceptual rental fields:

- platform_fee_total
- owner_platform_fee
- renter_platform_fee
- owner_fee_payment_status
- renter_fee_payment_status

The server must calculate and persist these values. Client-provided amounts must never become authoritative.

For a 50/50 split:
owner_platform_fee = platform_fee_total / 2
renter_platform_fee = platform_fee_total / 2

Canonical decimal handling and payment idempotency remain required.

## 6. UI communication

On listing/detail/booking surfaces, use concise language such as:

"کارمزد Rentora بین موجر و مستأجر به‌طور مساوی تقسیم می‌شود."

Supporting explanation:

"این کارمزد مشترک برای ایجاد تعهد و اعتماد بیشتر در فرآیند اجاره است."

Where payment details are shown, explicitly distinguish:
- مبلغ اجاره
- ودیعه
- سهم کارمزد موجر
- سهم کارمزد مستأجر

A separate concise non-escrow notice remains necessary:

"Rentora مبلغ اجاره و ودیعه را دریافت یا نگهداری نمی‌کند؛ این مبالغ مستقیماً بین موجر و مستأجر تسویه می‌شوند."

Final copy is subject to UX/content review.

## 7. Failure, cancellation and non-delivery implications

The shared-fee model changes the incentive structure but does not by itself define refunds or penalties.

Those rules must be designed as part of the Trust & Reliability / Rental Lifecycle system.

Required cases:
- owner non-delivery
- renter no-show
- mutual cancellation
- owner cancellation
- renter cancellation
- emergency / exceptional circumstances
- unresolved dispute

For an owner-confirmed non-delivery, the final policy should define what happens to each party's fee share and whether the owner's share is forfeited, refunded, or retained under a documented rule.

Do not implement automatic refunds or penalties until these policies are explicitly specified.

## 8. Reliability and abuse safeguards

The shared fee is one mechanism for commitment, not the sole enforcement mechanism.

The reliability system should still record:
- reservation events
- payment events
- contact-access events
- agreed handover time
- messages/coordination events where available
- handover confirmation
- non-delivery reports
- cancellation/no-show outcomes
- dispute decisions
- confirmed violations

Restrictions should be based on confirmed behavior and documented outcomes rather than a single unverified report.

## 9. Admin requirements

The Admin experience will eventually need to show, per rental:
- total platform fee
- owner share
- renter share
- payment status for each party
- refund/adjustment status where applicable
- lifecycle outcome
- dispute/non-delivery status
- audit events

Platform fee configuration must remain server-authoritative. The existing read-only fee configuration should not be made editable merely because the UI is being redesigned.

## 10. Product language

Preferred term:
- "سهم کارمزد رزرو" or "سهم کارمزد Rentora"

Avoid calling the owner's payment simply "listing fee", because the product intent is to tie the fee to rental commitment rather than charge an unrelated publishing fee.

## 11. Open implementation decisions

Before coding:
1. Is the owner's 50% share collected when the listing is activated, when a reservation is created, or by another reservation-linked mechanism?
2. Does an owner payment apply per reservation, per listing availability period, or another unit?
3. What happens to the owner's share if a renter cancels?
4. What happens to the renter's share if the owner cancels?
5. What happens to both shares in mutual cancellation?
6. What happens after confirmed owner non-delivery?
7. What happens after renter no-show?
8. Can an unpaid owner share make an otherwise active listing unavailable?
9. How are partial refunds represented in the Pi payment architecture?
10. What exact server/D1 schema changes are required?
11. How does this interact with existing payment intents, incomplete payments, A2U/refund capability and reconciliation?

## 12. Non-negotiable constraints

- No client-authoritative fee amounts.
- No fake/mock payment states.
- No implication of escrow.
- No replacement of the existing authoritative payment architecture without an audit-proven capability gap.
- Every financial transition must be idempotent and auditable.
- UI must distinguish owner/renter fee shares from rental price and deposit.
- Implementation must be validated against the real Pi Testnet flow.

## 13. Relationship to the UX redesign

This decision affects:
- Listing Detail
- Booking
- Owner listing activation
- Activity/Rental Timeline
- payment status
- cancellation
- Trust & Reliability
- Admin Treasury/Payout/Transactions

It must be incorporated into the research and UI specification before the affected screens are finalized in Figma.
