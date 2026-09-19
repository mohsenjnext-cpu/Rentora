# Arena Execution Checklist

Execute `ARENA_MASTER_PROMPT.md` against the current repository state.

## Priority order

1. Re-read current source and verify the audit claims.
2. Fix the confirmed `src/App.jsx` `items` runtime reference bug.
3. Trace and repair all dead/restart/retry UI paths.
4. Enforce D1 as the authoritative source for listings, prices, quotes and rental state.
5. Verify Pi payment metadata, amount, identity, network and status server-side.
6. Verify server-side admin authorization on every admin API.
7. Implement real server-side session revocation on logout.
8. Verify avatar persistence through R2 + D1.
9. Verify listing visibility across different authenticated/guest users.
10. Verify rental, contact, chat and review authorization boundaries.
11. Add integration tests for the critical workflows in the master prompt.
12. Run the complete test/build/syntax/diff verification suite.
13. Deploy and verify the Cloudflare Worker if deployment access is available.
14. Only after all verification succeeds, remove `AUDIT_REPORT.md` and other proven-obsolete artifacts in a separate cleanup commit.

## Required final evidence

Return exact evidence for:

- changed files
- deleted files and reasons
- migrations
- tests and exact counts/results
- build result
- syntax checks
- deployed URL/version and health result if deployment was performed
- admin 403 verification
- cross-user listing visibility verification
- authoritative server quote/payment verification
- avatar persistence verification
- direct-booking verification
- remaining limitations

Do not report a percentage readiness score. Distinguish code verification, test verification, deployed-runtime verification, and unverified items.
