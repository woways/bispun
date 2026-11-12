# Bispun CRM — Final Regression Report

**Branch:** `integration/bispun-final-pdf-review` · **Date:** 2026-11-12
**Isolated test DB:** local Postgres `bispun_final` @ localhost (separate from the active counselling session's `bispun_qa`). Host-guard confirmed localhost. No Neon host touched; no external sends (workers off, dummy creds).

## Executed tests (actual results)

| Suite | Command | Result | Evidence |
|---|---|---|---|
| **Unit** | `npm test` | **106 / 106 PASS** | node:test, 15 suites |
| **API integration** | `npm run test:integration` | **35 / 35 PASS** | spawns Express on :4199 vs `bispun_final`; HTTP + DB-row assertions |
| **Production build** | `npm run build` | **exit 0 (green)** | vite; recharts (`generateCategoricalChart`) emitted as a **separate chunk** (lazy), jspdf separate — confirms Track B code-split |
| **Chat 2-user (Socket.IO)** | ad-hoc socket client | **PASS** (verified earlier vs identical backend) | convo create + real-time `message:new` delivery + DB persist + sender identity |
| Lint / type-check | — | **N/A** | no lint/tsc script configured in `package.json` |

### What the API integration suite covers (all PASS)
authentication & sessions · Lead Store column-preferences (the P1) · stable Lead IDs (LDxxx, trigger) · role permissions (Employee/Manager/Admin) · tenant isolation (cross-tenant 403/404) · admissions + auto-provisioned locked folders · counselling + walk-ins · analytics/dashboard · chats & notifications · referrals lifecycle (no double-referral, no double-credit) · account-deletion requests · finance reads + writes.

## Coverage by requested area
| Area | Status | Note |
|---|---|---|
| Unit / API integration / build | ✅ executed, PASS | above |
| Auth / session | ✅ PASS | suite §1 |
| Role & tenant isolation | ✅ PASS | suite §3–4 |
| Lead ID generation | ✅ PASS | LD001, 0 NULL, sequential |
| Lead Store import/export | 🔍 code-verified | import/export UI not runtime-driven |
| Admissions conversion | ✅ PASS | admission create + lead link + locked folder |
| Finance calculations | ✅ (writes) / 🔍 (drill math) | admission financials persisted; KPI math code-verified |
| UTM attribution | 🔍 code-verified | influencer/medium stored (not UI-driven) |
| Referrals lifecycle | ✅ PASS | no-double-credit runtime-verified |
| Notifications | 🔍 code-verified | REST list PASS; grouping gap (16.3) |
| Chat Socket.IO 2-user | ✅ PASS | real-time send/receive |
| Permission enforcement | ✅ PASS | 403 + where-filter |
| Mobile navigation / Dashboard UI / Accessibility / refresh-persistence | ⚠️ NOT runtime-tested here | web UI + device; use the Manual QA Guide. sr-only tables & greeting are code-present + a11y-approved by Track B. |
| **Android (FCM push, audio, visual)** | ❌ NOT tested | needs emulator/device + real Firebase — **do not mark PASS**; Track B/device testing owns this |

## Honesty notes
- "🔍 code-verified" = implementation confirmed by reading code, **not** exercised at runtime. "✅ PASS" = actually executed with assertions.
- Android push/audio/visual and full browser-UI/role runtime testing were **not** performed here (no emulator; UI-runtime is the Manual QA Guide's job). They are **not** claimed as PASS.
- The excluded `fa0518f` referral-signup code was **not** tested (held out of the branch).
