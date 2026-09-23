# Rentora D1 migrations

## Deployment rule

`db/schema.sql` is the bootstrap schema for a new D1 database. It describes the current authoritative schema and is not a production data migration.

The numbered files before `0011` are historical migrations from earlier schema revisions. They are retained for audit/history and must not be replayed against the existing production database unless the D1 migration history has been independently verified to match that exact revision sequence.

`0011_schema_alignment.sql` is the first migration in the current forward-only policy. It is additive and idempotent: it uses only `CREATE ... IF NOT EXISTS` statements and contains no `DROP`, `DELETE`, `ALTER TABLE`, table rebuild, or data rewrite.

## Existing production database

1. Do not run `db/schema.sql` against production as a substitute for migrations.
2. Do not replay `0002` through `0010` on the production database merely because their files exist.
3. Verify the live schema before applying a migration.
4. Apply only the reviewed migration needed for the live schema state.
5. Keep deployment code-only. Schema changes are separate, explicit, and auditable operations.

## New database

For a brand-new D1 database, initialize from `db/schema.sql`. Future schema changes should be introduced as new additive/idempotent migrations after `0011`.

## Safety invariant

No deployment migration may perform destructive cleanup, expire/cancel business records, rebuild a populated table, or mutate production business data as a side effect of deployment.
