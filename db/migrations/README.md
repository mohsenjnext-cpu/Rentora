# Rentora D1 migration policy

## Production migration lineage

The repository keeps two distinct D1 migration histories:

- `db/migrations/`: reconstructed historical schema evolution (`0001` through `0011`). This is an auditable reconstruction used for disposable/local full-chain testing.
- `db/migrations-production/`: the migration lineage used by the live Rentora production D1 database.

The production database was originally bootstrapped with SQL/schema operations rather than a verified D1 migration ledger. Its live schema has been reconciled against the reconstructed chain and is already at the `0011` schema state. Its `d1_migrations` table is empty.

Therefore the live database must **not** execute the historical `0001` through `0011` files. Doing so would attempt to recreate objects that already exist.

## Production baseline

`db/migrations-production/0001_baseline_existing_schema.sql` is an intentional no-op baseline migration. It executes `SELECT 1` and records the baseline through Wrangler's normal D1 migration mechanism without changing tables, indexes, triggers, or application data.

This baseline is the first entry in the live database's migration ledger. Future production schema changes must be added as new sequential migrations under `db/migrations-production/`.

Do **not** manually insert rows into `d1_migrations`.

## Verification performed before baseline

1. The remote `d1_migrations` table was inspected and found empty.
2. The remote schema was inspected.
3. Remote tables, indexes, and triggers were compared with the schema produced by the complete historical chain.
4. The remote rental overlap triggers were verified to match the current `0011` policy: a 10-minute pending-payment hold and the same-renter renewal exception.
5. The complete historical `0001` through `0011` chain was applied successfully to a disposable local D1 database.

The production baseline therefore records the already-existing live schema state rather than replaying historical DDL against production.

## Production safety rule

The deploy workflow intentionally does not apply D1 migrations automatically. Production migrations must be reviewed and applied explicitly.

Before applying a future production migration:

1. Verify the target database and Wrangler configuration.
2. Test the migration against a disposable/staging database.
3. Review the SQL and expected schema/data impact.
4. Apply the migration explicitly to production.
5. Verify the resulting schema and `d1_migrations` ledger.

## Bootstrap schema

`db/schema.sql` remains the full bootstrap representation for a fresh database. It is intentionally separate from the production migration lineage because the live database already exists and already contains its application schema.

The historical migration chain remains available for full-chain reconstruction and regression testing. Any future schema change must be represented by a new forward production migration and, where appropriate, reflected in `db/schema.sql`.
