-- Rentora production D1 baseline.
-- The live database already contains the schema represented by
-- db/migrations/0001 through 0011. Migration 0001 was already recorded
-- remotely during the initial reconciliation attempt, so this baseline is
-- intentionally numbered 0002 and remains a no-op.
--
-- This establishes the production migration lineage without replaying the
-- historical DDL or modifying existing production data.
SELECT 1;
