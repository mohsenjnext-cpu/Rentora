# Rentora Home Research v0.1

Date: 2026-09-24
Branch: docs/project-state-uiux-audit
Status: Research only. No new visual UI or Figma work has started.

## 1. Purpose of this document

This document defines the first research pass for the redesigned Rentora Home. It is a decision input, not a final visual design. The rule is:

Research -> problems -> user goals -> useful patterns -> rejected patterns -> Rentora requirements -> UX decision -> UI specification -> prototype/Figma -> implementation -> real-backend validation.

The existing backend, business logic, Pi authentication, rental/payment flows, D1/KV, treasury and payout systems remain the product foundation. Home must consume those real capabilities rather than inventing new client-side business logic.

## 2. What Rentora Home is actually for

From the current product and codebase, Rentora is a peer-to-peer rental marketplace for physical items. The Home page therefore has one primary job:

Help a visitor understand what Rentora is, quickly find something useful to rent, and provide a clear path to either discover an item or list an item.

Home is not the place to explain every feature. It is the marketplace front door.

Primary jobs, in order:
1. Understand the marketplace proposition.
2. Start discovery/search.
3. Browse useful categories.
4. Scan trustworthy, relevant listings.
5. Understand the rental model and trust signals.
6. List an item when the user is a supplier/owner.
7. Move into the real listing detail and booking flow.

## 3. Current Rentora Home: observed facts

Current HomePage.jsx has separate mobile and desktop compositions.

Current mobile order:
1. Hero proposition
2. Post-item CTA
3. Search
4. Categories
5. Trust banner
6. Three marketplace statistics
7. Featured/latest items

Current desktop order:
1. Hero proposition
2. Post-item CTA
3. Search
4. CategoryBar
5. Trust banner
6. Three marketplace statistics
7. Featured/latest items

Current category set is: All, Tools, Cameras/Digital, Camping, Sports, Vehicles, Party, Home.

Current ItemCard includes:
- image
- KYC badge
- owner badge when relevant
- favorite
- location
- rating
- title
- daily price
- rent/manage CTA

Current Home has a second, separate MobileItemCard implementation. It omits rating and some desktop-card metadata and uses a different visual structure.

Important product/data observations:
- Home currently uses latest active items, not an explicit recommendation/ranking system.
- The statistics include item count, pioneer/user count, and a 100% handover claim.
- Search submits to Discover with a query.
- Category selection navigates to Discover.
- KYC is shown as a small badge.
- The booking CTA exists directly on cards.
- A generic remote fallback image is used when an item has no image. This should not be treated as a substitute for real listing media in the final design.
- The Home page currently contains hard-coded presentation details and duplicated mobile/desktop card logic.

## 4. External research: patterns worth studying

### Airbnb

Airbnb's current search documentation describes a search model centered on destination, dates and guests, with filters for important preferences and a Nearby option. Its current product materials also show strong category navigation and a persistent exploration model. This demonstrates a useful principle for Rentora: discovery should begin with a simple high-value search intent, while richer constraints can be progressively disclosed rather than dumped into the first screen.

Sources:
- https://www.airbnb.com/help/article/3117
- https://www.airbnb.com/help/article/252
- https://news.airbnb.com/wp-content/uploads/sites/4/2023/05/Airbnb-2023-Summer-Release-Media-Guide.pdf

### Etsy

Etsy currently places broad shopping categories directly beneath search and provides filtering and sorting on results. Etsy also describes category selection as a way to improve browsing and search discoverability. This supports using categories as a visible discovery accelerator, but Rentora should keep its category set smaller and rental-specific.

Sources:
- https://www.etsy.com/c
- https://help.etsy.com/hc/en-gb/articles/115015627947-How-to-Search-for-Items-and-Shops-on-Etsy
- https://www.etsy.com/seller-handbook/article/a-new-way-to-navigate-categories-on-etsy/29526805355

### Baymard research

Baymard's 2026 research emphasizes that search, filtering and sorting solve different jobs. Search finds by intent, filters narrow by attributes, and sorting prioritizes an existing result set. It also recommends mobile filter interfaces that use a dedicated layer and a clear result/apply action when filtering is complex. Its mobile research highlights the importance of list-item content, scanability, filtering and product-page structure.

Sources:
- https://baymard.com/research-articles/ecommerce-search-query-types
- https://baymard.com/blog/ecommerce-filter-ui
- https://baymard.com/research/ecommerce-product-lists
- https://baymard.com/research/mcommerce-usability

## 5. Research conclusions for Rentora

### Decision A: Home should be discovery-first

The first screen should not behave like an advertising landing page. The user should reach search/discovery almost immediately.

Required hierarchy:
1. What Rentora is / what can be rented.
2. Search.
3. Category shortcuts.
4. Trust/context.
5. Listings.

The "List an item" action should remain prominent, but it is secondary to discovery for the marketplace home.

### Decision B: Search should be the dominant interaction

Search should support natural intent rather than only exact title matching where the existing backend allows it.

Examples of intended user mental models:
- "دوربین برای یک روز"
- "ابزار نزدیک من"
- "کمپینگ"
- "ماشین"
- "اجاره ارزان"
- "دوربین زیر ۱۰ π"

The UI should be designed so that richer search semantics can be added later without changing the Home layout. Search logic itself must only be extended after the backend capability is audited.

### Decision C: Categories are discovery accelerators, not decoration

Categories should:
- be horizontally browsable on mobile
- remain quickly scannable
- have meaningful labels and icons
- reflect actual Rentora inventory
- avoid overwhelming users with a long taxonomy on Home

The current eight-category model is a starting point, not a final taxonomy.

### Decision D: Listing cards need one canonical system

There should be one ListingCard component with responsive behavior rather than separate desktop and mobile implementations.

Minimum information hierarchy:
1. Image
2. Listing title
3. Location
4. Rental price/unit
5. Trust/reputation signal when meaningful
6. Favorite
7. Primary action

The card should not become a tiny product-detail page. Users must be able to compare cards quickly.

### Decision E: Trust must be useful, not promotional

Rentora's trust model is unusual because it combines peer-to-peer handover, KYC/reputation and a separate platform fee paid through Pi.

Home should communicate trust in concrete terms:
- verified/KYC owner signal where available
- reputation where available
- clear explanation that Rentora does not imply escrow
- clear distinction between item rental and Rentora's platform fee when payment information is surfaced

Avoid vague claims that cannot be substantiated by the backend.

### Decision F: Marketplace statistics need evidence and meaning

The current "items / pioneers / 100% handover" block should not automatically survive the redesign.

A statistic belongs on Home only if:
- its data source is authoritative,
- its definition is clear,
- it helps the user decide whether to use Rentora,
- and it remains meaningful at current scale.

The 100% handover statement especially needs an explicit definition and trustworthy data source before being used as a prominent trust claim.

### Decision G: Featured/latest content needs an intentional rule

The current implementation takes the first active items. That is not a recommendation engine.

The new UI should use an explicit label such as "تازه اضافه‌شده‌ها" if it is truly latest-by-created-at, or "پیشنهادهای Rentora" only if a real recommendation/ranking rule exists.

Do not call arbitrary first-array items "featured."

### Decision H: Empty states are part of the Home design

When there are no active listings, Home should not look broken.

The empty state should:
- explain why there are no visible listings,
- offer "List your first item" as the supply-side CTA,
- optionally explain that discovery will improve as the marketplace grows,
- avoid fake sample listings.

## 6. Proposed Home information architecture

### Mobile

1. Compact brand/navigation shell
2. Primary discovery block
   - short value proposition
   - dominant search field
   - optional location/context shortcut only if real location capability is available
3. Category rail
4. Trust explanation
5. Fresh/relevant listings
6. Supply-side CTA: list an item
7. Footer/support/legal where appropriate

### Desktop

1. Header
2. Wide discovery/search block
3. Category rail
4. Fresh/relevant listing grid
5. Trust / how Rentora works
6. Supply-side CTA
7. Footer

The exact ordering of trust vs listings remains a validation decision. The first prototype should test both:
- trust before listings
- trust after first listing row

## 7. Home component requirements

Foundation:
- responsive page container
- typography tokens
- buttons
- inputs
- badges
- surfaces
- skeletons
- empty/error states

Home:
- Hero/Search block
- Search input
- Search suggestions/autocomplete layer
- Category rail
- Canonical ListingCard
- Listing grid
- Trust explanation
- Supply CTA
- optional marketplace metrics component, conditional on validated data

Interactions:
- search submit
- category navigation
- listing open
- rent action
- favorite
- list-item CTA
- loading
- no listings
- no results
- error
- unauthenticated interaction
- authenticated owner interaction

## 8. Mobile behavior requirements

Rentora is Pi Browser-first, so mobile is not a reduced desktop layout.

Requirements:
- search remains easy to reach
- category rail is horizontally scrollable
- cards are readable at two-column widths without microscopic text
- touch targets should be comfortably tappable
- favorite must not conflict with card navigation
- primary CTA must remain obvious
- filter/search refinement belongs in a dedicated layer on Discover, not overloaded into Home
- no horizontal page scrolling
- RTL must be native rather than achieved by reversing arbitrary visual order

## 9. Patterns to reject

Do not copy:
- giant marketing hero sections that push marketplace content below the fold
- excessive carousels without a clear discovery purpose
- fake scarcity ("only 1 left") unless backed by real inventory
- fake popularity or review counts
- arbitrary "featured" ranking
- dense filter controls on Home
- cards with too many badges
- payment amounts that look like Rentora holds the user's rental money
- decorative trust badges with no authoritative meaning
- separate mobile and desktop component implementations when the underlying behavior is the same

## 10. Open decisions before UI design

These must be answered before Figma:

1. What is Rentora's primary Home promise in one sentence?
2. Is the main discovery model keyword search, category browsing, location browsing, or a combination?
3. What location data is actually available and trustworthy?
4. What should the default listing ordering be?
5. Which listing attributes are authoritative enough for Home cards?
6. What exactly does KYC mean to the user and what state does the backend expose?
7. Should rating appear on Home cards when there are no reviews?
8. Which categories are actually populated enough to deserve Home visibility?
9. Should Home show platform-level statistics at all?
10. What is the exact meaning and data source of the current 100% handover metric?
11. Should "List an item" be a header CTA, hero CTA, or both?
12. Should Home include a short "How Rentora works" explanation, and if so, where?
13. What search capabilities exist today versus what we want to add later?

## 11. Research-phase acceptance criteria

We do not move to visual design until:
- Home's primary job is agreed.
- Search behavior is defined at UX level.
- Category strategy is defined.
- Listing-card information hierarchy is agreed.
- Trust language is factual and non-misleading.
- Statistics have authoritative definitions or are removed.
- Default listing ordering is explicit.
- Mobile and desktop behavior are defined.
- Loading/empty/error states are defined.
- No UI decision requires inventing backend financial or marketplace state.

## 12. Next research step

Next, research and decide the canonical Rentora ListingCard and discovery result experience. That work should compare:
- listing information density,
- image treatment,
- trust/reputation signals,
- price/unit presentation,
- location,
- favorite,
- CTA,
- card behavior on mobile,
- no-image and no-review states,
- and the transition from Home card -> Listing Detail -> Booking.

Only after that should we produce the first Home wireframe and Figma specification.
