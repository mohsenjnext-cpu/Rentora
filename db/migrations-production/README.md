# Production D1 migrations

This directory is the active Wrangler migration lineage for the live Rentora D1 database.

The historical reconstructed chain remains under `db/migrations/` for audit and disposable/local full-chain testing. The live database already had that schema before Wrangler's migration ledger was established. During reconciliation, historical migration `0001_initial_schema.sql` was recorded remotely, so the production lineage uses `0002_baseline_existing_schema.sql` as an intentional no-op baseline. It does not replay historical DDL or modify existing production data.

Migration `0003_authoritative_schema_bootstrap.sql` is the forward, idempotent schema bootstrap. It is safe on the existing database because it only creates missing objects and indexes; it also gives a newly-created D1 database the same authoritative table/trigger surface expected by the Worker. Future production schema changes must be sequentially numbered after 0003. Do not manually modify `d1_migrations`.
