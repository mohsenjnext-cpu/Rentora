# UI-04 Reservation & Payment Decision

## Research basis

Baymard's mobile checkout research emphasizes keeping the final amount visible before payment, keeping the order summary accessible, and making the primary payment action explicit.

## Rentora decisions

- Mobile-first, RTL/Persian-first reservation flow.
- Date selection is the first required input.
- The reservation summary always separates rental total, security deposit, and Rentora platform fee.
- Rental total and security deposit are direct P2P settlement at handover.
- Rentora platform fee is the only online Pi payment.
- Displayed price, deposit, rental total, fee, fee rate, and duration must come from the current server quote.
- No client-side financial fallback is allowed in the production reservation/payment path.
- No offline/local draft may be promoted into a real paid reservation.
- The primary CTA is disabled while the authoritative quote is loading or absent.
- Payment starts only after a server-created rental/payment obligation exists.
- Pi SDK payment uses the server-created payment intent amount and metadata.
- Reservation confirmation and contact unlock remain server-authoritative after verified Pi completion.
- Rental/deposit amounts are never presented as Rentora-held funds or Rentora revenue.

## Explicit implementation constraints

1. POST /api/rentals/quote creates the authoritative quote.
2. POST /api/rentals accepts the quote snapshot and creates the reservation/payment obligation.
3. Pi createPayment obtains the authoritative amount again from POST /api/payments/intent.
4. POST /api/payments/approve and POST /api/payments/complete validate the obligation and Pi payment server-side.
5. UI must not synthesize a fee when the quote is unavailable.

## Owner activation fee contract

The owner activation fee is paid before a rental exists, so it cannot depend on a renter-selected rental duration. Rentora therefore defines the pre-rental owner obligation as the owner's 50% share of the platform fee for **one canonical rental day at the listing's authoritative daily price and fee rate**.

Formula:
- Canonical one-day platform fee = price_per_day × platform_fee_rate, subject to the server minimum fee.
- Owner activation fee = 50% of that canonical one-day platform fee.
- The renter pays 50% of the actual reservation platform fee calculated from the selected dates.
- Rental price and deposit remain direct P2P settlement and are never part of Rentora's Pi fee transaction.
- The owner activation obligation is listing-level and tied to an activation cycle. It is not recreated for every rental.
- If the listing's daily price or fee rate changes, a new activation cycle uses the new authoritative values.

The activation API returns the activation cycle, amount, fee rate, and canonical one-day basis so the UI can explain the obligation before Pi payment. This contract intentionally does not claim that the owner and renter payments are equal for every multi-day rental. The 50/50 split applies to the platform-fee calculation at each applicable obligation basis.

## Validation

- BookingModal no longer falls back to client-side financial calculation for reservation creation/payment.
- BookingModal no longer creates a local/offline rental when server reservation creation fails.
- Listing images and location no longer use fabricated fallback content in the reservation header.
