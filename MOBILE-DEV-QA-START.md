# Bispun CRM — Dev-only schema update applied + QA stack up

Date: 2026-11-02 · Branch **`integration/mui-yc` @ `9730561`** · worktree `S:\Bispun-integ`.
**Dev-only. Nothing pushed, merged or deployed. Production (`ep-weathered-credit`)
never contacted or modified.**

## 1. Migration — APPLIED exactly as approved
Ran only the approved statement against **`bispun-mobile-dev`**:
```sql
ALTER TABLE "Lead" ADD COLUMN IF NOT EXISTS "alternatePhone" TEXT;
```

**Pre-apply checks (all passed → SAFE-TO-APPLY):**
| Check | Result |
|---|---|
| Endpoint = `ep-blue-mouse-b4if0xzj` (dev), **not** `ep-weathered-credit` | ✅ |
| `current_database` / `current_schema` / `Lead` table | `neondb` / `public` / present (20 cols) |
| Column still missing | ✅ confirmed absent |
| Integration schema expects nullable String | ✅ `alternatePhone String?` (Lead model) |
| Recovery plan | Additive, nullable, **0 existing rows** → zero data risk; rollback `ALTER TABLE "Lead" DROP COLUMN IF EXISTS "alternatePhone";`; Neon point-in-time restore also available |

**Post-apply verification:**
| Check | Result |
|---|---|
| Column exists | ✅ `alternatePhone` |
| Type / nullable / default | **`text` / nullable (YES) / no default** |
| Existing `Lead` rows preserved | ✅ 0 before → 0 after |
| Any other migration / `prisma db push` | ❌ **none run** (only the one approved `ALTER`) |

## 2. Dev backend — up, dev DB only, workers disabled
Started from the integration worktree:
```bash
cd S:\Bispun-integ
CLIENT_URL="http://localhost:5173,http://localhost:5174" node --env-file=.env.development server/index.js
```
(`PORT=4000`. The `--env-file` loads the dev `DATABASE_URL`; the inline `CLIENT_URL`
only widens the CORS allowlist — see §4. It does **not** change `DATABASE_URL`.)

| Check | Result |
|---|---|
| `GET /api/health` | ✅ `{ success:true, database:"connected" }` |
| Resolved `DATABASE_URL` endpoint (exact startup resolution: `--env-file` + `dotenv/config`) | **`ep-blue-mouse-b4if0xzj` (dev)** — `is_prod:false` |
| `DISABLE_BACKGROUND_WORKERS` before startup | **`true`** — nurture worker + subscription-lifecycle timer **not started** (code gate `server/index.js:284`) |
| Connects only to `bispun-mobile-dev` | ✅ confirmed (dev endpoint is the only `DATABASE_URL` in the process; dotenv does not override the `--env-file` value) |

## 3. Integration frontend — ready for desktop QA on the dev API
- **URL: http://localhost:5174** (Vite dev, integration code `integration/mui-yc @ 9730561`).
- API base pointed at the dev backend via a **gitignored, dev-only** override
  `S:\Bispun-integ\.env.development.local` → `VITE_API_URL=http://localhost:4000`
  (the committed `.env` uses `http://10.0.2.2:4000`, which is the Android-emulator
  alias and unreachable from a desktop browser; this override is local-only and does
  not touch committed env, the APK, or production).
- Login page renders correctly on desktop (1440×900).
- **Cross-origin reachability confirmed:** a credentialed `fetch` from `localhost:5174`
  to `http://localhost:4000/api/health` returned `database:"connected"` (CORS OK).

> ⚠️ Use **http://localhost:5174**, not 5173. Port 5173 is held by a **separate,
> pre-existing Vite** (PID 15496, not started by me and not touched) — that is a
> different/stale frontend.

## 4. Why the inline CLIENT_URL was needed (CORS)
`.env.development` sets `CLIENT_URL=http://localhost:5173` only. Vite fell back to
**5174** (5173 was occupied), so the backend's CORS allowlist (`config.clientOrigins`,
from `CLIENT_URL`) rejected 5174 — the first health `fetch` failed. Adding 5174 via the
**inline** `CLIENT_URL` at launch fixed it **without editing any env file** and without
changing the dev `DATABASE_URL`.

## 5. Constraints honored
No other migrations / no `prisma db push`; no test records, messages, calls or
notifications created; no production service restarted or modified; nothing pushed,
merged or deployed. Background workers stay disabled.

## Backend / frontend health — summary
| Service | Where | State |
|---|---|---|
| Dev API | `http://localhost:4000` | ✅ healthy, dev DB, workers off |
| Integration frontend | `http://localhost:5174` | ✅ serving, login renders, hits dev API |
| Dev DB | `bispun-mobile-dev` (`ep-blue-mouse`) | ✅ migration applied, Lead.alternatePhone present |

## Next QA steps (for you)
1. Open **http://localhost:5174** and **log in manually** (QA Admin / Employee) — I will
   not enter credentials or create data.
2. Then run the combined QA (from `MOBILE-INTEGRATION-QA-PREP.md`): **Lead Store**
   (Lead IDs, **alternatePhone** show/save, KPIs, filters, phone menu incl. **Dial &
   track**), **Smart Nurture**, **Dial & Track**, plus Revenue / Help / Analytics /
   My Store / Counselling / UTM Leads / Walk-ins, and a Chat/Calendar/Dashboard
   regression spot-check — on desktop and mobile widths.
3. Keep background workers disabled; do not send real WhatsApp/SMS/email or place calls.

**STOP — migration applied, dev stack healthy and bound to `bispun-mobile-dev`.
Awaiting your manual login (or your go-ahead for me to drive read-only UI QA).**
