# Rentora Trust & Reliability / Rental Lifecycle Research v0.1

Date: 2026-09-25
Branch: docs/project-state-uiux-audit
Status: Research and product design baseline. No implementation started.

## 1. Purpose

Rentora's reservation model creates a specific trust problem: the renter pays the Rentora fee and receives access to the owner's private contact information only as part of the reservation flow. If the owner then fails to deliver the item, the renter can lose the practical value of the reservation even though Rentora does not hold the rental price or security deposit.

The product therefore needs a formal Rental Reliability system, not only a generic report button.

This research must be designed together with the newly approved 50/50 platform-fee model:
- total Rentora platform fee is split equally between owner and renter;
- rental price and security deposit remain direct P2P amounts;
- Rentora remains non-escrow.

## 2. Current codebase baseline

The current `src/services/rentalStateMachine.js` already defines these states:
- requested
- accepted
- payment_pending
- confirmed
- active
- completed
- rejected
- cancelled
- disputed

The current state machine allows a confirmed rental to become active when handover is verified and allows a confirmed or active rental to enter disputed. It does not currently define dedicated lifecycle states for:
- awaiting handover
- non-delivery
- owner no-show
- renter no-show
- mutual cancellation
- resolution outcome

The current state machine also contains an existing concept of `disputed`, so the new reliability system should extend the existing architecture rather than replace it.

## 3. External research: useful patterns

### Airbnb host cancellation and reservation issues

Airbnb's current policies illustrate several useful marketplace patterns:
- host cancellation can trigger guest refund and consequences for the host;
- consequences can include blocking the affected dates and, for repeated/severe cases, listing or account restrictions;
- exceptions can exist for documented circumstances outside the host's control;
- reservation issues can require timely reporting and supporting evidence;
- Airbnb can evaluate the severity and evidence of an issue when deciding refund/rebooking outcomes.

Sources:
- https://www.airbnb.com/help/article/4117
- https://www.airbnb.com/help/article/2868
- https://www.airbnb.com/help/article/2278

These are external product patterns, not requirements that Rentora must copy.

### Evidence and dispute handling

eBay's seller protection guidance shows another useful pattern: dispute outcomes can depend on evidence and required response windows. For non-receipt disputes, evidence of delivery or collection can be relevant.

Source:
- https://www.ebay.com/help/policies/selling-policies/payment-est-seller-protections?id=5293

For Rentora, the equivalent evidence is more likely to be:
- reservation event history
- agreed handover time/location
- in-app messages
- contact-access events
- handover confirmation
- cancellation events
- user-submitted evidence where appropriate

## 4. Product problem

The problem is not simply "owner does not answer for 24 hours."

There are several different failure modes:
1. Owner cancels before handover.
2. Owner does not respond before the agreed handover.
3. Owner responds but does not appear.
4. Owner appears but the item is unavailable.
5. Renter does not appear.
6. Both parties agree to cancel.
7. An emergency or external event prevents handover.
8. The parties disagree about what happened.
9. A report is false or unsupported.

These cases must not be collapsed into one generic "failed booking" status.

## 5. Proposed lifecycle

A clear rental timeline should expose the operational state to both parties:

1. Reservation created
2. Required platform-fee payments completed
3. Reservation confirmed
4. Handover coordination
5. Handover due
6. Handover confirmed
7. Rental active
8. Return due
9. Return confirmed
10. Completed

Exception path:

Reservation confirmed
→ Handover issue reported
→ Evidence / response window
→ Resolution:
   - owner responsible
   - renter responsible
   - mutual cancellation
   - valid exception
   - unresolved / admin review

The UI should not expose internal adjudication complexity unless a user is actually involved in a dispute.

## 6. Handover confirmation

Handover should become an explicit event.

Recommended UI:
- "کالا تحویل شد"
- "مشکل در تحویل"

Both renter and owner can confirm handover.

A handover event should record:
- rental ID
- actor
- timestamp
- event type
- current rental state
- relevant payment state
- optional note/evidence reference

The exact evidence requirements should be kept lightweight for normal rentals. Requiring a photo or complicated proof for every successful handover would add friction to a P2P marketplace.

## 7. Non-delivery reporting

The renter should have a prominent action after the handover due time:

"مشکل در تحویل"

Then:
"مالک کالا را تحویل نداده است"

The report should capture:
- whether the renter reached the agreed handover point
- whether the owner responded
- whether the owner appeared
- whether the item was available
- optional short description
- optional supporting evidence

The report should create a structured rental event rather than only creating a generic support ticket.

## 8. Response and grace periods

Do not use one universal 24-hour rule.

A better model is event-relative:
- before handover: coordination reminder / response concern;
- near the agreed handover time: handover reminder;
- after the agreed handover time: issue reporting becomes available;
- after a defined response window: the case can become eligible for automated or admin resolution depending on confidence.

The exact durations should be configurable and validated during implementation.

The UI should always show the actual agreed handover date/time instead of hiding behind a generic "24 hours" promise.

## 9. Shared-fee implications

With the approved 50/50 model, the reliability policy should explicitly define fee consequences.

Conceptual fields:
- platform_fee_total
- owner_platform_fee
- renter_platform_fee
- owner_fee_payment_status
- renter_fee_payment_status

The following outcomes need explicit policy before implementation:
- owner-caused non-delivery
- renter no-show
- owner cancellation
- renter cancellation
- mutual cancellation
- valid emergency/exception
- unresolved dispute

Do not automatically refund or forfeit either share until the policy is approved.

## 10. Reliability consequences

The system should use progressive, evidence-based consequences.

Possible sequence:
1. First confirmed owner-caused failure: recorded incident + warning.
2. Repeated confirmed failures: temporary listing/booking restriction.
3. Continued failures: stronger account restriction and admin review.
4. Severe or repeated abuse: suspension subject to policy.

For a confirmed owner non-delivery, the affected listing can also be temporarily unavailable until the owner confirms availability again.

The same principle should apply to renter-side repeated no-shows, without assuming the two behaviors have identical consequences.

Do not use a public score or badge until the underlying metric is statistically and operationally meaningful.

## 11. Reliability metrics

Potential internal metrics:
- completed rentals
- confirmed owner non-delivery incidents
- confirmed renter no-show incidents
- owner cancellation count
- renter cancellation count
- successful handover confirmations
- response behavior where measurable

Potential future public signal:
"۱۲ اجاره تکمیل‌شده · ۰ عدم‌تحویل تأییدشده"

Only expose metrics that are:
- based on authoritative events;
- understandable;
- protected against misleading small-sample interpretation;
- defined consistently.

## 12. False-report safeguards

A report alone must not automatically punish an account.

The system should:
- notify the other party;
- preserve the event timeline;
- allow a response;
- distinguish verified outcomes from allegations;
- permit admin review for disputed cases;
- keep an audit trail of the decision.

Repeated unsupported reports by a renter should themselves be detectable as a reliability signal.

## 13. Listing availability

A listing involved in a confirmed owner-caused non-delivery should not remain blindly bookable.

Possible states:
- temporarily unavailable while the issue is open;
- unavailable for the affected dates;
- re-enabled after owner confirmation or admin resolution.

This is safer than deleting the listing and preserves the owner's ability to recover from a legitimate incident.

## 14. Financial and non-escrow boundary

Trust & Reliability does not turn Rentora into an escrow service.

Rentora manages:
- reservation lifecycle
- platform fee payments
- contact access
- event history
- reporting
- dispute handling
- reliability restrictions

Rentora does not hold:
- rental price
- security deposit

Any refund of a Rentora platform fee is a separate platform-fee operation and must be explicitly designed in the Pi payment architecture.

## 15. Admin requirements

Admin should eventually have:
- rental incident queue
- issue type
- rental timeline
- both parties
- payment states
- handover state
- evidence
- response status
- prior confirmed incidents
- decision
- decision reason
- audit trail
- resulting restrictions
- resulting fee/refund action

Admin should not need to manually inspect raw database records for routine cases.

## 16. UX surfaces affected

This system affects:
- Listing Detail
- Booking flow
- owner listing management
- Activity/Rental Timeline
- Messages/coordination
- handover confirmation
- cancellation
- dispute/report UI
- profile/reputation signals
- Admin Reports
- Admin Treasury/Transactions when a platform-fee refund exists

It should therefore be treated as a product-wide system, not a single page feature.

## 17. Open decisions before implementation

1. Exact owner fee collection point under the 50/50 model.
2. Exact renter fee collection point.
3. Handover deadline rules.
4. Reminder schedule.
5. Grace period.
6. Who can report which issue and when.
7. Required evidence for each issue type.
8. Owner response window.
9. Automatic versus admin resolution thresholds.
10. Fee refund/forfeiture rules for each outcome.
11. Listing lock rules.
12. Progressive restriction thresholds.
13. Emergency/exception policy.
14. Public reliability metrics, if any.
15. Pi payment/refund/reconciliation mechanics.
16. Required D1 schema and audit-event model.

## 18. UX principles

- Protect both sides, not only the renter.
- Never punish based only on an unverified accusation.
- Make the next action obvious at every lifecycle stage.
- Show concrete dates/times rather than vague countdown language.
- Keep financial concepts separate: rental, deposit, owner fee, renter fee.
- Keep the non-escrow model explicit.
- Make successful handover easier than reporting a problem.
- Make serious failures easy to report.
- Keep routine cases automatic where evidence is strong.
- Escalate ambiguous cases rather than guessing.
- Preserve a complete audit trail.

## 19. Research conclusion

The shared 50/50 platform fee model makes a dedicated Trust & Reliability system more important, because both sides now have a direct platform-fee commitment.

The next design step should be a complete Rental Lifecycle specification covering:
- owner fee commitment
- renter booking/payment
- contact unlock
- coordination
- handover confirmation
- non-delivery
- no-show
- cancellation
- dispute
- fee outcome
- reliability consequence

Only after those rules are fixed should the corresponding Booking, Activity and Admin UI be moved into Figma and implementation.
