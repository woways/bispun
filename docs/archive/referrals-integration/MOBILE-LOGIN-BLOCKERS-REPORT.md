# Bispun CRM — Login Blockers Status (Production + Development)

**Branch:** `fix/bispun-web-mobile-stabilization` · **Dev DB:** blue-mouse · **Prod DB:** pond (not touched) · nothing pushed/deployed.

## 1. Status

| Environment | Status | Summary |
|---|---|---|
| **Development login** | **PASS** | login → `/auth/me` → logout all work with the retry fix active. |
| **Production login** | **BLOCKED → hotfix ready** | Backend/CORS/pond/auth all verified healthy; "Unable to sign in" is a transient DB cold-start 500 on the *deployed* build, which lacks the retry fix. Isolated hotfix prepared, not deployed. |

## 2. Confirmed root causes

### Development — RESOLVED
- Dev frontend `http://localhost:5173`, backend `http://localhost:4000`, DB blue-mouse (Neon). Health: `GET /` 200; `/api/health` 200 `database: connected`.
- Earlier failures were blue-mouse **cold-start timeouts** (ETIMEDOUT on `prisma.user.findUnique` → HTTP 500). Commit `830c9e1` (retry + 503) fixes this; it is active on the running dev backend.
- Evidence (QA account `bispun.qa.admin@example.com`, approved dev account): login → **HTTP 200** (token issued); `/auth/me` → authenticated user `Bispun Mobile QA`; logout succeeds. First cold login can be slow (~4–20s) but now **succeeds** instead of erroring.

### Production — HIGH-CONFIDENCE, ONE ITEM UNVERIFIED
- Prod frontend `https://bispun.com/login`, API `https://api.bispun.com`, DB pond (Neon serverless).
- Verified healthy: `GET /` → 200; CORS allows `https://bispun.com` + `https://www.bispun.com`; a **dummy invalid** login (no real credentials) returns **HTTP 401 "Invalid email or password"**, which the deployed UI displays correctly.
- Therefore "Unable to sign in" is **not** invalid credentials and **not** CORS. It is the generic text the **deployed backend returns as its HTTP 500 on a pond cold-start timeout** — the deployed build predates the retry fix. Same failure class as dev, on pond.
- **UNVERIFIED (stated plainly):** a *live* production cold-start 500 was not captured (pond was warm during testing), and **I do not have access to the Render backend logs** to confirm it directly. Confirmation requires the Render logs around a reported failure. The prepared fix is safe and correct for this failure mode regardless.

## 3. Do the prepared commits address the failure mode? — YES
- `830c9e1` — wraps the login user lookup in `withDbRetry` (retries transient DB errors: ETIMEDOUT/ECONNRESET/P1001/P1002/P1008/P1017/P2024) so a cold start that fails once succeeds on retry; a persistent transient failure returns **HTTP 503 + Retry-After** with a retry-friendly message instead of a bare 500. Credential paths unchanged (400 missing / 401 invalid, no enumeration). No keepalive, no driver swap, no security change.
- `590b2e1` — frontend maps 400/401/403/503 to accurate messages and network/5xx to a retry-friendly one; error banner announced (`role="alert"`). accessibility-lead: PASS.
- Proven live in dev (same code path, same Neon DB class).

## 4. Prepared hotfix (isolated, NOT pushed/deployed)
- Branch **`hotfix/prod-login-coldstart`** = `origin/main` (`2219749`) + cherry-picks:
  - `a495abf` (= `830c9e1`) backend retry/503
  - `c55388f` (= `590b2e1`) frontend login messages
- Contains **only** the two login commits — no Finance, no Lead Store, no unrelated work.
- Production build: **PASS**. `npm test` (push service/dispatch unit tests): **PASS** (no dedicated auth suite exists in the repo).

## 5. Test evidence
| Test | Result |
|---|---|
| Prod `GET /` | HTTP 200 (~0.7s) |
| Prod dummy login (Origin bispun.com) | HTTP 401 "Invalid email or password" |
| Prod CORS app.bispun.com / crm.bispun.com | 403 "Origin not allowed" (expected; not the live frontend) |
| Dev login (QA) | HTTP 200 + token |
| Dev `/auth/me` | authenticated user returned |
| Dev logout | success |
| Hotfix branch `vite build` | PASS |
| Hotfix branch `npm test` | PASS |

## 6. Remaining blockers
- **Production:** final root-cause confirmation needs Render backend logs (no access here) **or** approval to deploy the hotfix and observe. Deploy needs explicit approval.
- No development blockers remaining.

## 7. Deployment & rollback plan (await explicit approval)

**Deploy (on approval):**
1. `git push origin hotfix/prod-login-coldstart`
2. Open a PR `hotfix/prod-login-coldstart` → `main` (small, 2 commits); review the diff.
3. Merge to `main`. This triggers the existing auto-deploys: **Vercel** (frontend `bispun.com`) and **Render** (backend `api.bispun.com`).
4. After deploy: re-test real login on `https://bispun.com/login`; watch Render logs for the 503/retry path; confirm no new errors.

**Rollback (if needed):**
- Backend (Render): "Rollback"/redeploy the previous deploy, or `git revert` the merge commit and push → auto-redeploy. The change is additive (retry + 503 mapping) and low-risk.
- Frontend (Vercel): "Instant Rollback" to the previous production deployment, or revert the merge commit.
- No DB migration is involved, so rollback is code-only and safe.

**Notes:** No production data touched. No secrets exposed. `pond` unchanged. The larger Finance/Lead Store work on `fix/bispun-web-mobile-stabilization` (PR #4) remains separate and is not part of this hotfix.
