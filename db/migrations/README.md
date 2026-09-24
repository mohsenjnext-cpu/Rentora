# Rentora D1 migration policy

## Current migration chain

The repository now has a complete forward-only chain:

- `0001_initial_schema.sql`: reconstructed from the original schema commit immediately before migration 0002.
- `0002` through `0010`: historical schema evolution already present in the repository.
- `0011_rental_overlap_policy.sql`: forward-only correction that aligns the historical 30-minute overlap trigger with the current 10-minute pending-payment policy.

Wrangler is configured to discover migrations from `db/migrations`.

## Production safety rule

The existing production D1 database was originally bootstrapped with SQL/schema operations rather than a verified D1 migration ledger. Therefore **do not run `wrangler d1 migrations apply --remote` against production until the remote `d1_migrations` table has been inspected and reconciled**.

Cloudflare records applied migration names in `d1_migrations`. The migration chain must match that ledger before any remote migration is applied.

The deploy workflow intentionally does not apply D1 migrations automatically. This remains intentional.

## Adoption procedure

1. Inspect the production D1 migration ledger with Wrangler.
2. Inspect the actual production schema.
3. Compare both with the migration chain in this repository.
4. If the ledger is empty or incomplete while the schema is already at the post-0010 state, establish an explicit, auditable baseline procedure before applying any pending migration.
5. Test the complete chain on a disposable/staging D1 database first.
6. Only then apply the reviewed forward migrations to production.

Never manually insert rows into `d1_migrations` or run the migration chain against production merely to make Wrangler report green. The ledger is part of the deployment state, not a cosmetic checklist.

## Bootstrap schema

`db/schema.sql` remains the current full bootstrap representation. It is useful for creating a fresh database directly, while `db/migrations/*.sql` is the authoritative history for incremental schema evolution.

The two representations must remain semantically aligned. Any intentional divergence must be represented by a forward migration and documented here.
