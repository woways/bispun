# Bispun CRM — Login Reliability Fix (evidence-based)

**Branch:** `fix/bispun-web-mobile-stabilization` · **Dev DB:** blue-mouse (production `pond` untouched) · nothing pushed.

## Confirmed root cause

The intermittent login failures ("Unable to sign in", long loading → failure, HTTP 500) are caused by **Neon dev-compute (blue-mouse) cold-start / wake latency**, surfacing as a Prisma `ETIMEDOUT` on `prisma.user.findUnique()` in the login handler, which the handler returned as a generic **HTTP 500**.

It is **NOT**:
- a credential problem (the query fails before the password is checked),
- a code/schema bug,
- a port-5432 / firewall / McAfee / TLS block (an earlier claim I **retract** — see below),
- the database being permanently down.

### Evidence (layer-by-layer, correct PostgreSQL methodology)

| Layer | Result |
|---|---|
| DNS resolution | OK — resolves to Neon AWS IPs (+ a Neon edge IP; confirmed via 1.1.1.1 too) |
| Raw TCP :5432 | OK (~0.3–2.3s to each IP) |
| **PostgreSQL SSLRequest → `S` → TLS** | **OK, `authorized=true`, ~1–1.7s** (hostname and explicit IP) |
| Authenticated `SELECT 1` (pooler + direct) | OK ~3s when warm; **ETIMEDOUT ~22s during a cold/stuck wake** |
| Backend `GET /` (no DB) | 200 in ~19ms |

**Retraction:** my first diagnosis used `tls.connect()` directly on port 5432. PostgreSQL does not start in TLS — the client must send an 8-byte **SSLRequest** (code 80877103) and read the server's `S`/`N` byte *before* TLS. The raw `tls.connect()` had no SSLRequest preamble, so the server ignored it and the test "timed out" — a **false positive**. Re-tested correctly, port 5432 + TLS work fine. The McAfee/firewall attribution was wrong.

## The fix (minimal, dev-safe, no driver swap, no keepalive)

Since 5432/TLS work, Neon's HTTP/443 driver is **not** needed. The fix makes the login path tolerant of cold starts and reports failures accurately.

**Backend — `server/routes/clientAuth.js`** (commit `830c9e1`)
- Added `isTransientDbError()` + `withDbRetry()`; the login user lookup now retries transient DB errors (ETIMEDOUT/ECONNRESET/P1001/P1002/P1008/P1017/P2024, timeout messages) up to 2 times with short backoff. Warm logins are unaffected (succeed on attempt 1).
- A persistent transient failure now returns **HTTP 503 + `Retry-After: 5`** with a retry-friendly message, not a generic 500, and never leaks internals.
- Credential/validation paths unchanged: **400** missing fields, **401 "Invalid email or password"** for both wrong password and unknown email (no user enumeration).

**Frontend — `src/ClientLogin.jsx`** (commit `590b2e1`)
- Error mapping by class: server message for 400/401/403/503; retry-friendly message for network/timeout/5xx-with-no-body; generic fallback otherwise.
- Error banner now has `role="alert"` (announced to screen readers); icon `aria-hidden`. accessibility-lead review: **PASS**.

## Evidence distinguishing invalid credentials from DB failure

| Test | HTTP | Message | Duration |
|---|---|---|---|
| Correct credentials | **200** | — (session issued) | ~8.6s (cold), ~3s (warm) |
| Wrong password | **401** | Invalid email or password | ~0.4–6s |
| Non-existent email | **401** | Invalid email or password (identical → no enumeration) | ~0.4s |
| Missing password | **400** | Email and password are required | ~0.03s |
| Cold-start DB timeout | **503** (after retries) | retry-friendly "wait a moment and try again" | — (code-verified) |

QA accounts verified present & active on blue-mouse (read-only, **not reset**): `bispun.qa.admin@example.com` (CLIENT_ADMIN) + empA/empB, company "Bispun Mobile QA" = ACTIVE; plus QA Company B.

## Platform results

- **Web login: PASS** — correct creds → 200 and the authenticated Dashboard renders ("Bispun Mobile QA"); error matrix returns correct 400/401 with accurate messages; warm reconnect ~3s.
- **Android login: NOT RE-TESTED (blocked)** — requires the Pixel 6 emulator to be launched. The same backend handler serves Android, so the resilience + error mapping apply there too; needs on-device confirmation before marking PASS.

## Remaining risks / notes

- A **cold start still adds latency** (first login after idle can take ~8–25s, or ~26s if a retry is needed) — it now **succeeds** instead of erroring, but it is slow. A warm-keeping solution (keepalive) was **not** added (requires separate approval). Production `pond` is kept warmer by traffic, so this is mainly a dev annoyance.
- The 503 path is code-verified but could not be exercised live (Neon suspend can't be forced on demand here).
- Pre-existing minor login-form a11y items (show/hide button nested in `<label>`; field-level error association) were left as-is (optional, AA already met).
