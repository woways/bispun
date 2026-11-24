# Bispun CRM — Final Integration Dev-QA Preparation (read-only)

Date: 2026-11-02 · Integration branch **`integration/mui-yc` @ `9730561`** · worktree
`S:\Bispun-integ`. **All checks below were read-only. Nothing started, written,
migrated, pushed, merged or deployed. No env file changed. No DB record touched.**

---

## 1. Integration worktree + git status
| Item | Value |
|---|---|
| Integration worktree | `S:\Bispun-integ` → branch **`integration/mui-yc`** |
| Integration HEAD | **`9730561`** (restore of Smart Nurture + Dial & Track) |
| Integration working tree | **clean** (no uncommitted changes) |
| Main checkout | `S:\Bispun` → `feat/mobile-ui-optimization` @ `c6b55cc` |
| `main` | `496fa88` (untouched) |

## 2. Development DB identity — by ENDPOINT, not DB name
Both environments use the Neon database **named `neondb`**, so the name does **not**
distinguish them. The **endpoint host** does:

| Env file | Endpoint (host first-label) | Identity |
|---|---|---|
| `.env` | `ep-weathered-credit-axobwesm` | **Existing production CRM** — must NOT be used/modified for mobile QA |
| `.env.development` | `ep-blue-mouse-b4if0xzj` (pooler) | **`bispun-mobile-dev`** — the dedicated QA DB |

Confirmed against the live `.env.development` endpoint: **1 Company** present, and it
matches the mobile/QA tenant. This is the correct isolated dev DB.

## 3. ⚠️ How the backend selects its DB — ACTION REQUIRED before QA
`server/index.js` line 1 is **only** `import "dotenv/config";`. Plain `dotenv`
**always loads `.env`** — it does **not** auto-switch to `.env.development` by
`NODE_ENV`. Both npm scripts load `.env`:
- `"server": "node --watch server/index.js"`
- `"server:prod": "node server/index.js"`

**Consequence:** `npm run server` as-is would connect the backend to the **existing
production CRM** (`.env`), *not* `bispun-mobile-dev`. To run QA against the dev DB the
backend **must be started with an explicit override**, e.g.:

```bash
node --env-file=.env.development --watch server/index.js
```

(`--env-file` is read before `dotenv/config` runs, so the dev `DATABASE_URL` wins.)
This changes nothing on disk — it only selects the env at launch. **I have not started
any backend.**

## 4. Background workers
`DISABLE_BACKGROUND_WORKERS=true` is set in **`.env.development`** only (it is **not**
set in `.env`). So:
- Started with `.env.development` → **nurture worker stays disabled** ✅ (required for QA).
- Started with plain `.env` → the worker would **run** ❌ (another reason to use the
  `--env-file=.env.development` launch above).

The nurture worker is gated in `server/index.js` by
`process.env.DISABLE_BACKGROUND_WORKERS === "true"`.

## 5 + 6. Live dev-DB schema vs integration schema & migration files
Read-only inspection of `bispun-mobile-dev` vs `integration/mui-yc` `prisma/schema.prisma`:

| Object (integration schema) | In `bispun-mobile-dev`? | Source migration | State |
|---|---|---|---|
| `DeviceToken` table (9 cols) | ✅ **exists** (all columns match) | `prisma/pending-migrations/0001_add_device_token.sql` | **already applied** |
| `Lead.assignedToUserId`, `Lead.followUpAt`, `LeadRemark` | ✅ exist | `prisma/manual/lead_store_remarks_followup.sql` | **already applied** |
| `WalkIn.alternatePhone` | ✅ exists | (via `prisma db push`) | already applied |
| **`Lead.alternatePhone`** | ❌ **MISSING** | **no migration file exists** | **needs migration** |

Note: this project migrates with **`prisma db push`** (`"prisma:push"`), not
`prisma migrate` — there is no standard `prisma/migrations/` history folder; pending
work lives in `prisma/pending-migrations/` and `prisma/manual/`.

## 7. Is a migration required? — YES, exactly one column
Only **`Lead.alternatePhone`** is missing. It is declared `alternatePhone String?`
(nullable) on the `Lead` model. The integration backend (Lead Store rewrite) and the
restored UI read this field via Prisma, so **Prisma queries would fail at runtime
until the column exists.** Everything else the integration needs is already present.

## 8. Prepared migration SQL + rollback — **NOT APPLIED**
Single additive, **nullable** column → metadata-only change in PostgreSQL: no table
rewrite, no backfill, no row locks beyond an instantaneous catalog update. Idempotent.

**Forward (prepared — would be `prisma/pending-migrations/0002_add_lead_alternate_phone.sql`):**
```sql
-- Additive, nullable. Apply ONLY to the dedicated dev DB (bispun-mobile-dev),
-- NEVER to production (.env / ep-weathered-credit).
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "alternatePhone" TEXT;
```

**Rollback:**
```sql
ALTER TABLE "Lead" DROP COLUMN IF EXISTS "alternatePhone";
```
Safe immediately after apply (column is empty). After QA enters data, a rollback would
discard only that dev test data.

**Apply options (later, on your approval only):**
- **Recommended (surgical):** run the single `ALTER` against the `.env.development`
  `DATABASE_URL`, then `npm run prisma:generate`.
- **Convention (`prisma db push`):** `node --env-file=.env.development ...` / set the
  dev `DATABASE_URL`, then `npm run prisma:push`. Because only this one column differs,
  `db push` should report exactly this addition — but confirm the diff before accepting.

**Safety:** verify the target endpoint is `ep-blue-mouse-b4if0xzj` (dev) **before**
running anything. Never run against `ep-weathered-credit` (production).

## 10. Have the feature branches advanced since `9730561`?
Fetched `--all`. The branches that feed this integration are **unchanged**:

| Branch | Head | Changed since merge? |
|---|---|---|
| `feat/mobile-ui-optimization` | `c6b55cc` | No |
| `feat/your-changes` | `d0628dc` | No |
| `main` | `496fa88` | No |
| `feat/mobile-native-actions` | `9548bde → d29381b` | **Advanced** — but this is a *separate* branch, **not** part of `integration/mui-yc`. Flag only. |

So `integration/mui-yc @ 9730561` is still built on the current tips of both merged
branches. No re-merge needed.

---

## 9. Combined Mobile + Desktop QA plan
**Prerequisites (need your go-ahead):** apply the `Lead.alternatePhone` migration to
`bispun-mobile-dev`; start the backend with `--env-file=.env.development` (workers
disabled); you log in manually (QA Admin / Employee). *Do not send real
WhatsApp/SMS/email, do not place real calls, keep workers disabled.*

Run each area on **mobile (emulator/≤lg)** and **desktop (≥lg)**.

**Lead Store (rewrite — highest priority)**
- Lead list + **Lead ID** column render; **`alternatePhone`** shows and saves.
- KPIs (Datasets/Imported/Converted/Duplicates); filters, search, view, Export CSV, pagination.
- Row phone menu: **Dial number** (`tel:`), **WhatsApp**, **Message (SMS)**, and
  **Dial & track** — all present and **distinct**.
- Mobile: KPI cards **2-column**, no number clipping. Desktop: table + multi-col KPIs.

**Smart Nurture (restored)**
- Header **Smart Nurture** button opens the modal with the selected-lead count.
- Sequences list loads; **New sequence** form; **Process due now**; enrol selected leads;
  error/success banners; **Esc / Android back / X** close and return focus to the button.
- Mobile = bottom-sheet scrolls; Desktop = centered dialog. *No real sends.*

**Dial & Track (restored)**
- Row menu → **Dial & track** opens CallCenterModal; calling mode/status shows.
- Record outcome (connection/outcome/duration/notes) saves; **Call history** loads;
  a **Recording** link (if any) is a separate control from Edit; Esc/back/X + focus return.
- *No real calls.* Confirm it does not duplicate the quick **Dial number**.

**Other touched modules (functional + layout, mobile + desktop)**
- **Revenue**, **Help** — KPI 2-col on mobile, desktop columns, values not clipped.
- **Analytics**, **My Store**, **Counselling**, **UTM Leads**, **Walk-ins** — load,
  core actions work, responsive layout correct.

**Regression spot-check (should be unchanged)**
- Chat (mobile keyboard-safe composer + desktop two-pane), Calendar (mobile agenda +
  desktop week grid), Dashboard KPIs, Android hardware-back, notifications, session.

**Automated (green on `9730561`; re-run after migration):**
`vite build` clean · `node --test` 40/40 · `prisma validate` valid.

---

## Summary / STOP
- Integration worktree clean @ `9730561`; feeding branches unchanged.
- Dev DB = `bispun-mobile-dev` (`ep-blue-mouse`), distinct from production (`ep-weathered-credit`).
- Backend must be launched with **`--env-file=.env.development`** to hit the dev DB
  **and** keep workers disabled.
- **One migration required:** add nullable `Lead.alternatePhone` (SQL + rollback above).
  DeviceToken and all other integration schema objects already exist in the dev DB.

**Awaiting your approval to (a) apply the `Lead.alternatePhone` migration to
`bispun-mobile-dev`, then (b) bring up the dev backend and run the QA plan. Nothing
applied/started.**
