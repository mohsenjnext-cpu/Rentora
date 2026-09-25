# UI-02 Research Decision: Discover and Listing Card

Date: 2026-09-25

## Research inputs

- Baymard's 2026 search research reports that users commonly rely on search and that search results should make applied scopes/filters visible and actionable. citeturn0search3turn0search1
- Baymard's product-list research emphasizes scannability and displaying the attributes users need to decide whether to open or skip an item. citeturn0search6
- Baymard's mobile research recommends an explicit applied-filter overview above mobile results and treats mobile filtering as a distinct interaction from desktop filtering. citeturn0search5turn0search4

## Rentora decisions

### Discover

1. Search remains the primary entry point.
2. Results count and sort remain visible near the result list.
3. Applied filters are shown as removable chips above results.
4. Mobile filters open as a bottom sheet rather than a centered desktop-style dialog.
5. Category is a first-class filter.
6. Price is a range, not a hard-coded single maximum in the UI contract.
7. Condition and location remain available filters.
8. Reset is always available when filters are active.
9. No-result state must explain the current scope and provide a clear reset action.
10. Sorting is limited to meaningful marketplace choices: newest, lowest price, highest price, rating.

### Listing Card

The card must support fast comparison without pretending to be a reservation.

Required:
- primary image
- title
- location
- daily rental price
- optional deposit when authoritative data exists
- trust/KYC indicator when authoritative data exists
- rating when authoritative data exists
- availability/status when relevant

Not shown on the card:
- Rentora fee as if it were part of the rental price
- rental total, because dates are not selected yet
- security/deposit as Rentora revenue
- fabricated ratings, availability, or payment state

The primary CTA is contextual:
- owner: manage
- renter: view/reserve

The entire card remains the navigation target, while CTA and favorite controls stop event propagation.

## Implementation boundary

This phase changes only Discover and the reusable listing card. It does not change booking/payment business logic.
