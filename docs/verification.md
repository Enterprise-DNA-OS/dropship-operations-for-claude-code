# Verification

17 November 2026. Linux, Node 22.23.4, embedded PGlite.

- npm install completed with no reported vulnerabilities.
- npm test passed 84 assertions across all 30 CLI operations.
- Tests cover atomic import rollback, dry-run isolation, repeated imports, stale stock rejection, quantity limits, partial shipments, returns, ambiguity, append-only history, exports and report rendering.
- npm run demo passed and rendered three dashboards and seven documents from fictional data.
- Desktop and mobile dashboard screenshots were inspected in headless Chromium. The page has no horizontal overflow; wide report tables scroll within their cards.
- The page examples were captured from the real demo commands on this date. Demo dates change with the day the demo runs.

[GitHub Actions run 44002543734](https://github.com/Enterprise-DNA-OS/dropship-operations-for-claude-code/actions/runs/44002543734) passed all three jobs on 17 November 2026: Node 22 on Windows, Node 22 on Linux, and Postgres 17. Both operating systems passed npm test and npm run demo. The Postgres job passed the same 84-assertion suite against a disposable server.

No real Duoplane export or live store connection was tested. Import examples are fictional. Purchase-order cutover requires the mapping and reconciliation described in the switching guide.
