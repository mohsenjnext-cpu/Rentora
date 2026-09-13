-- Migration 0005: Listing private contact and coordination details
-- Stores private contact info for listings that is only accessible after confirmed booking.

CREATE TABLE IF NOT EXISTS listing_contacts (
  listing_id TEXT PRIMARY KEY REFERENCES listings(id) ON DELETE CASCADE,
  contact_name TEXT,
  contact_phone TEXT,
  whatsapp TEXT,
  preferred_contact_method TEXT DEFAULT 'phone',
  contact_hours TEXT,
  coordination_notes TEXT,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_listing_contacts_listing ON listing_contacts(listing_id);
