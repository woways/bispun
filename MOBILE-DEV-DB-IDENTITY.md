# Bispun CRM — Dev DB Identity Check (Phase 1.1 + F) — STOPPED on a discrepancy

Date: 2026-11-01 · Read-only (forced read-only transactions, all rolled back; **no
writes, no record changes, no secrets printed**). **No merge/push/deploy.**

## ⚠️ Key finding: the committed `.env` database is NOT the one the mobile QA app uses

I could **not** confirm that `ep-weathered-credit-axobwesm` / `neondb` is the
intended `bispun-mobile-dev` project. Evidence shows it's a **different database**
than the one the running `:4000` backend (and the mobile QA app) actually use:

| Evidence (from `.env` DB `neondb @ ep-weathered-credit-axobwesm`) | Implication |
|---|---|
| Companies present: **BISPUN** (Hyderabad, 5 users), **Student Mentor** (5), **testcompany1** (1). **No "Bispun Mobile QA" / "QA (dev test)" tenant.** | The mobile QA tenant isn't here. |
| **No user** with `@example.com` (the mobile QA account `bispun.qa.admin@example.com`). | The QA account isn't here. |
| **Latest ClientSession = 2026-11-01 10:38**, only **1 session today**. | My mobile QA logins (~15:34–21:00 today) created sessions **elsewhere**, not here. |

Since the emulator hits `10.0.2.2:4000` = host `localhost:4000`, and that backend
served the QA tenant successfully, **the live `:4000` backend is using a different
`DATABASE_URL` than the repo's committed `.env`** (most likely a shell-exported
`DATABASE_URL` that `dotenv/config` does not override). The real `bispun-mobile-dev`
database is that other endpoint, which I can't read (not in a readable terminal,
and I won't extract the secret).

## 🚩 Safety implication (please review before any merge or write-test)
The repo's **committed `.env` `DATABASE_URL` points at `neondb`, which holds
real-looking client tenants** (BISPUN/Hyderabad with `woways.in` users, "Student
Mentor"). Anything run with the repo default env — `npm run server` without the
override, `npx prisma ...`, `prisma/seed.js` — would target **that** database, not
the isolated QA dev DB. I can't tell from here whether `neondb` is a shared/older
dev DB or production-adjacent, but it is **not** the isolated QA environment and it
contains real-looking data. Worth confirming/segregating before release.

## Phase 1 environment (recap, with the correction)
- `NODE_ENV=development` in `.env`/`.env.development` (not proof of DB identity).
- Firebase project **`bispun-crm`**; server FCM admin creds present (`bispun-fcm-admin.json`), `firebase-admin` installed. Single project → QA push must target only the emulator's dev token.
- Deploy triggers **only** on push to `main` (Render API + Vercel web).
- Web is emulator-configured (`VITE_API_URL=http://10.0.2.2:4000`).

## Phase F — read-only audit result (on the `.env` DB, which is the wrong one)
Performed read-only (transaction forced read-only + rolled back). Because this
isn't the QA DB, it **cannot** answer "is there a second QA user for Chat" for the
real environment. For reference, in `neondb`: BISPUN has 5 users and Student Mentor
has 5 (so multi-user tenants exist there), but that's not the QA tenant.

## Phase A — NOT started (held)
Per your instruction to confirm DB identity first (and because it failed), I did
**not** spin up the desktop session or ask you to log in yet. Note: a desktop Vite
session pointed at `localhost:4000` would hit the **live** `:4000` backend (the
real QA DB) — i.e. the same environment the mobile QA already used — so it's safe
and consistent **once we agree that's the intended target**. It does not use the
`.env` `neondb` at all.

## What I need from you to continue
1. **Confirm the real dev DB:** how is the `:4000` backend started, and what
   `DATABASE_URL` / Neon endpoint does it use (the real `bispun-mobile-dev`)? Either
   point me to it (a dev value you authorize) or run the Phase F audit yourself.
2. **Clarify `neondb`:** is the committed `.env` `DATABASE_URL` (`ep-weathered-
   credit-axobwesm`) a stale/other dev DB, a shared DB, or production? Should it be
   corrected so repo defaults don't hit real data?
3. **Phase A go-ahead:** OK to start the desktop Vite session against the **live
   `:4000`** backend (real QA env) and have you log in? (It won't touch `neondb`.)

## Status
- Identity: ❌ **NOT confirmed** (evidence it's a different DB than QA).
- Phase F: ⚠️ ran read-only on the wrong DB; **inconclusive** for the QA env.
- Phase A: ⏸️ **held** pending your confirmation of the correct backend/DB.
- Production release: 🔴 still **NO-GO** — now also pending DB-identity/segregation
  clarity, on top of the earlier gated runtime tests.

**STOP — no writes, no records changed, no merge/deploy. Awaiting your clarification
on the dev database identity.**
