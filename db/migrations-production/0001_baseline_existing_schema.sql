-- Rentora production D1 baseline.
-- The live database was already provisioned to the schema represented by
-- db/migrations/0001 through 0011 before a verified D1 migration ledger existed.
-- This no-op migration establishes the first auditable Wrangler migration
-- entry without recreating or modifying any production schema or data.
SELECT 1;