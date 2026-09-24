# Production D1 migrations

This directory is the active Wrangler migration lineage for the live Rentora D1 database.

The first migration, `0001_baseline_existing_schema.sql`, is intentionally a no-op. It records the already-existing production schema as the starting point for future incremental migrations without replaying the historical bootstrap chain.

Add future production migrations here as sequential numbered SQL files. Do not manually modify `d1_migrations`.

The historical reconstructed chain remains under `db/migrations/` for audit and disposable/local full-chain testing.
