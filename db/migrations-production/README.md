# Production D1 migrations

This directory is the active Wrangler migration lineage for the live Rentora D1 database.

The historical reconstructed chain remains under `db/migrations/` for audit and disposable/local full-chain testing. The live database already had that schema before Wrangler's migration ledger was established. During reconciliation, historical migration `0001_initial_schema.sql` was recorded remotely, so the production lineage uses `0002_baseline_existing_schema.sql` as an intentional no-op baseline. It does not replay historical DDL or modify existing production data.

Add future production migrations here as sequential numbered SQL files, starting after the recorded baseline. Do not manually modify `d1_migrations`.
