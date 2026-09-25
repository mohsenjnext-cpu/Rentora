# UI-03 Listing Detail Decision

## Research basis
- Baymard's mobile product-page research emphasizes that users can miss important content on small screens, so the page must expose the key decision information in a clear vertical hierarchy.
- Product imagery is a primary inspection path. Additional images should be visibly discoverable rather than hidden behind ambiguous dots.
- Mobile product pages should avoid forcing important information into secondary subpages when it can remain visible in the main flow.
- For Rentora, the equivalent of a product-page "buy section" is the reservation CTA, but financial semantics differ because rental price and deposit are direct P2P amounts and Rentora only processes the platform fee.

Sources:
- https://baymard.com/research/product-page
- https://baymard.com/research-articles/always-use-thumbnails-additional-images
- https://baymard.com/research/mcommerce-usability

## UX decision
1. **Hero/gallery first**
   - Large primary image.
   - Visible thumbnail strip when multiple authoritative images exist.
   - No fabricated remote fallback image. Missing media gets an explicit empty state.
2. **Decision information before long description**
   - Category, location, title, rating/review state, and owner trust/KYC.
   - Daily rental price is clearly labeled as the rental amount.
   - Deposit is shown separately and explicitly as direct P2P, not Rentora revenue.
3. **Financial trust**
   - Never present rental total without selected dates.
   - Do not invent a listing-level Rentora fee because the authoritative fee is reservation/date dependent.
   - Reservation flow fetches the server quote and shows the actual platform fee before Pi payment.
4. **Trust and privacy**
   - Owner identity/KYC is visible when authoritative.
   - Contact information remains private until the reservation's required fee is confirmed.
5. **Mobile action**
   - Keep the reservation CTA visible in a sticky bottom action bar.
   - Owner sees management actions instead of a renter booking action.
6. **Reviews**
   - Show authoritative review count/rating.
   - Empty state explicitly says there are no reviews rather than inventing a score.
7. **No mock production behavior**
   - No fake listing images, ratings, availability, balances, payment status, or fee values.

## Implementation scope
- Refine `ItemDetailPage` around the above hierarchy.
- Preserve the existing BookingModal as the reservation/payment vertical slice.
- Keep legacy navigation working while the new shell/vertical slice is incrementally hardened.
