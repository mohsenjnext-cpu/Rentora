-- Migration 0007: Authoritative Rental-Based Rating & Review System
-- Replaces old reviews table with secure, rental-tied reviews table.

DROP TABLE IF EXISTS reviews;

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  rental_id TEXT NOT NULL REFERENCES rentals(id) ON DELETE CASCADE,
  listing_id TEXT NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  reviewer_user_id TEXT NOT NULL REFERENCES users(id),
  reviewee_user_id TEXT NOT NULL REFERENCES users(id),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'hidden', 'flagged')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(rental_id, reviewer_user_id, reviewee_user_id)
);

CREATE INDEX IF NOT EXISTS idx_reviews_rental ON reviews(rental_id);
CREATE INDEX IF NOT EXISTS idx_reviews_listing ON reviews(listing_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewer ON reviews(reviewer_user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reviewee ON reviews(reviewee_user_id);
