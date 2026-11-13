# Bispun CRM — Automated Regression Results (2026-11-13)

**Branch:** `integration/bispun-final-pdf-review` (worktree `S:\Bispun-final-review`).
**DB safety (verified before any write):** effective `DATABASE_URL`/`DIRECT_URL` resolve to **`localhost` / `bispun_final`** (isolated, disposable). No shell env override. Not Neon (`neon|ep-weathered|ep-blue-mouse|pond|blue-mouse` guard passed). Workers OFF; SMTP/Firebase/WhatsApp/SMS/Razorpay dummy.

## Suites verified present on the branch
`package.json` scripts: `test` ✓, `test:integration` ✓, `build` ✓. Files: `server/__tests__/api.integration.test.js` ✓, `server/__tests__/gapClosure.integration.test.js` ✓, `scripts/provisionQaTestCompany.js` ✓.

## Results (actual, executed 2026-11-13)
| Suite | Command | Result |
|---|---|---|
| Unit | `npm test` | **106 / 106 PASS** |
| API integration | `npm run test:integration` | **35 / 35 PASS** |
| Five-gap closure | `node --test --test-force-exit server/__tests__/gapClosure.integration.test.js` | **5 / 5 PASS** |
| Production build | `npm run build` | **green (exit 0)** |
| **Total automated** | | **146 / 146 PASS** |
| Lint / type-check | — | N/A (no lint/tsc script configured) |

## Infrastructure incident encountered + resolved (honest record)
On first re-run today, **all DB-dependent suites failed (integration 0/35, gap 0/5)** while unit (106/106) and build passed. Root cause: **local Postgres was unusable** — the postmaster was alive but every backend fork failed on Windows with `could not reserve shared memory region ... error code 487`, so connections were accepted then dropped ("server closed the connection unexpectedly"). This is a **Windows Postgres environment fault (address-space/ASLR conflict), not a code or branch defect**. Resolved by a **clean `pg_ctl -m fast stop` + fresh `start`** (new address space; log then showed "database system is ready to accept connections", no error 487). Re-ran → all suites green. (A stale `postmaster.pid` from an earlier forced process kill was also cleared by the clean stop.)

> Note: a prior forced stop of a `pg_ctl` wrapper via the task runner had killed the server process group — restart Postgres with `pg_ctl ... start` and do **not** force-kill the `pg_ctl` wrapper.

## Interpretation
- The 146/146 count is **legitimately re-run today** after fixing the Postgres infra issue — not carried over.
- No application defects surfaced in this run. The only genuine bug in scope (counselling P1) is already fixed on the branch (see `BISPUN_COUNSELLING_P1_VERIFICATION.md`).
- Earlier intermittent failures were **environment (Postgres) / test-harness**, differentiated from application behavior.

## Not covered by automated runs (by design)
Browser UI across roles, Android/FCM/device, and production verification — see `BISPUN_MANUAL_QA_GUIDE.md` and `BISPUN_FIVE_GAP_CLOSURE_REPORT.md` "remaining" section. Not claimed as PASS.
