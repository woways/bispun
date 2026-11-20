# Bispun CRM — Complete Change Verification (excluding Referrals, Settings UI, Coupons)

**QA/verification only — no application code changed in this task.**

## A. Environment & identity
| Item | Value |
|---|---|
| Worktree tested | `S:\Bispun-final-review` |
| Branch | `integration/bispun-final-pdf-review` |
| Commit SHA | **`833a5d23d8e34365e3a2e0e7395bff5c5030a8ea`** (`833a5d2`) |
| Working tree | clean |
| Frontend | http://localhost:5178 (Vite) |
| Backend | http://localhost:4200 (`/api/health` → `{database:"connected"}`) |
| Database | **`bispun_final` @ localhost:5432** — isolated, disposable, local QA DB (NOT Neon/production; verified no shell override). Authorized for synthetic QA data. |
| Workers / external | `DISABLE_BACKGROUND_WORKERS=true`; SMTP/WhatsApp/SMS/Firebase/Razorpay dummy → no external sends. |
| Roles used | Client Admin `it.admin@qa-a.local`, Manager `it.manager@qa-a.local`, Employee `it.employee@qa-a.local` (qa-test-co). |

### Unmerged notification deep-link work (NOT in the tested branch)
- **Frontend:** `feat/notification-deep-links` @ **`af5c254`** ("deep-link calendar events + support tickets, web + Android") — Track B; **not merged into integration**.
- **Backend:** `qa-fix/notification-deeplinks-backend` @ **`621059a`** (producers emit `dashboard#event:<id>` / `help#ticket:<id>`) — Track A; **not merged into integration**.
- Integration (833a5d2) `notificationTarget.js` is still lead-only (`c77ce3d`). **Therefore calendar/ticket/finance notification deep-links are NOT active in the tested codebase** and are reported PENDING/PARTIAL here, verified separately on their branches.

## Excluded (per scope): §11 Referrals, §13 Settings/User-Permissions **UI**, §17 Coupons & Referral codes — **NOT APPLICABLE** (not audited as modules). Permission *enforcement* affecting Chats/Admissions/Leads IS tested.

---

## B/C/D/E. Per-section results (status · evidence)

### §1 Dashboard (1.1–1.7) — see `BISPUN_DASHBOARD_SECTION1_VERIFICATION.md`
| Req | Status | Evidence |
|---|---|---|
| 1.1 all 8 Business Pulse KPIs open contributing records | **PASS (live)** | All 8 clicked: Total/Qualified/New→Lead Store filtered; Admissions→Admissions; Potential/Received/Pending/Profit→Finance drill. Values = drill record counts (API-confirmed). |
| 1.2 Payments Pending shows Lead IDs | **PASS (live)** | LD006/LD007/LD008 badges. |
| 1.3 Action Center → exact Lead Details | **PASS (live)** | "Open in Lead Store"→Lead Details LD006. |
| 1.4 Export above Action Center matches records | **PASS (live+API)** | Export CSV = 9 cols × 10 rows = count; every row a valid LDxxx. |
| 1.5 calendar reminder exactly 10 min, no premature/duplicate | **PASS (API)** | 8-min event → reminder; 15-min → none; once-only (marker dedup). |
| 1.5 bell visibility | **PASS (live)** | reminder shows in bell "Calendar event in 10 minutes". |
| 1.6 web notification sound | **CODE VERIFIED** (pending human listening) | `playNotificationSound()` fires on unread increment; not audible headless. |
| 1.7 Android notification + sound + nav | **BLOCKED** (no device/emulator) | mobilePush REMINDER→sound in code; delivery unverified. |
| Calendar reminder → exact event navigation | **FAIL (live, integration)** | targets `dashboard`; no-op from Dashboard. Fixed on af5c254 (unmerged). |

### §2 Global Lead ID (2.1–2.4) — see `BISPUN_LEADID_SECTION2_VERIFICATION.md`
| Req | Status | Evidence |
|---|---|---|
| 2.1 LD001-style IDs | **PASS (live+API)** | leadNumber 29→LD029 etc. |
| 2.2 every lead has ID (manual/import/admissions) | **PASS (API)** | trigger `Lead_assign_lead_number` on all insert paths; manual create got LDxxx instantly. |
| 2.3 same ID across modules | **PASS (live)** | LD027 identical in Lead Store, Admissions, Analytics, Counselling, Action Center. |
| 2.4 internal cuid preserved | **PASS (API)** | `id` is cuid, separate from `leadNumber`. |

### §3 Lead Store (3.1–3.19) — see `BISPUN_LEADSTORE_SECTION3_VERIFICATION.md`
3.1 View/Filter never overlap **PASS(live)** · 3.2 Interested College **PASS(live+API persist)** · 3.3 Activity Refresh **PARTIAL(code)** · 3.4 remark after refresh **PASS(API)** · 3.5 KPI cards drill **PASS(live)** · 3.6 Course+Other **PASS(live)** · 3.7 Other free-text persists **PASS(live+API)** · 3.8 Source+Other **PASS(live)** · 3.9 Source list **PASS(live)** · 3.10 arrow inset **PASS(live)** · 3.11 Import dropdowns **PASS(live)** · 3.12 IMDM **PARTIAL / DECISION REQUIRED** (IM+DM separate, no single "IMDM") · 3.13 Import type **PASS(live)** · 3.14 Add Lead types **PASS(live)** · 3.15 Smart Nurture WhatsApp-only **PASS(live)** · 3.16 stable IDs **PASS** · 3.17 no false green **PASS(live)** · 3.18 neutral wording+CSV export **PASS(live)**; CSV **import file upload NOT TESTED** · 3.19 green only ≥1 **PASS(live)** · duplicate detection **PASS(API 409)** · lead search **PASS** · employee visibility **PASS(live: admin 17/mgr 0/emp 0)**.

### §4 UTM Leads (4.1–4.8)
| Req | Status | Evidence |
|---|---|---|
| 4.1 no duplicated lead types in UTM | **PASS (live)** | generator has only Destination/Campaign/Influencer/Platform/Medium/Cost. |
| 4.2 UTM creation works | **CODE VERIFIED** | "Generate & Save" form present; not submitted (no-write rule). |
| 4.3 Influencer Name field exists | **PASS (live)** | field in generator. |
| 4.4/4.5 Influencer Name for manual links + persists | **PASS (live)** field present in "Manually Add UTM Link"; **persistence CODE VERIFIED**. |
| 4.6 UTM Medium dropdown | **PASS (live)** | Social/Paid Social/CPC/Organic/Referral/Influencer/WhatsApp/SMS/Offline-QR/**Other**. |
| 4.7 Medium Other persistence | **CODE VERIFIED** | Other present; not written. |
| 4.8 Links/Registrations/UTM Leads drill-downs | **PASS (live, nav)**; data-match **NOT TESTED** (0 UTM data) | "View details" scrolls to/highlights the relevant table. |
| UTM analytics filtering/counts | **NOT TESTED** (0 data) | |

### §5 Chats (5.1–5.5)
| Req | Status | Evidence |
|---|---|---|
| 5.1/5.2 single + multiple deletion | **CODE VERIFIED** | delete handlers present; not exercised (must not delete convos in shared env). |
| 5.3 authorized Manager/Employee deletion | **CODE VERIFIED** | permission-gated. |
| 5.4 unauthorized hidden/rejected + backend enforcement | **CODE VERIFIED** | backend auth checks; gap-suite GAP2 (Chats) passed earlier (runtime). |
| 5.5 Join Meet shares ONE link for both participants | **CODE VERIFIED** | single conversation meeting link; two-account join not live-tested (needs 2 sessions). |

### §6 Admissions (6.1–6.14)
| Req | Status | Evidence |
|---|---|---|
| 6.1–6.3 attachment/college/stream visibility perms | **CODE VERIFIED** | locked-folder perms; gap-suite GAP1 (locked folders) passed earlier. |
| 6.4–6.6 KPI drill + counts match records | **PASS (live)** | Overall 10 = "10 shown"; International → "0 shown / No admissions". |
| 6.7 every admission has Lead ID | **PASS (live)** | LD006–LD027. |
| 6.8 existing-lead reuse same ID | **PASS (live)** | same LDs as Lead Store. |
| 6.9 independent admission creates/links Lead | **CODE VERIFIED** | not created (no-write). |
| 6.10 Lead Store → Admission Done | **PASS (live)** | these leads show Converted/Admission Done. |
| 6.11 Stream dropdown + Other | **PARTIAL** | Stream dropdown present (General); Other + custom persistence CODE VERIFIED. |
| 6.12 custom stream persistence | **CODE VERIFIED** | |
| 6.13 college list changes by stream | **NOT TESTED** | only "General" stream seeded. |
| 6.14 University/Affiliation label | **CODE VERIFIED** | |
| approved college master dataset | **DECISION REQUIRED** (§20) | |

### §7 Counselling (7.1–7.4)
7.1 Sessions Today click → "Showing records behind the selected KPI" **PASS(live)** · 7.2 This Week **PASS(live, KPI present/filter pattern)** · 7.3 Online Meet label + Schedule Session **PASS(live)** (shows "Online Meet", not "Video Call") · 7.4 dropdown spacing/arrow **CODE VERIFIED**.

### §8 Walk-ins (8.1–8.2)
| Req | Status | Evidence |
|---|---|---|
| 8.1 International/Domestic KPIs | **PARTIAL** | header "Domestic Walk-ins"; KPIs are status-based (Walk-ins/Converted/In Progress/Lost), no explicit Int'l/Domestic KPI split. |
| 8.2 other KPIs + count matches list | **PASS (live)** | Walk-ins 3 = 3 rows; Lead ID column (LD004). |

### §9 Finance (9.1–9.13)
| Req | Status | Evidence |
|---|---|---|
| 9.1 every KPI drill-down | **PASS (live)** | 9 KPIs with "View"; Dashboard drill proved contributing records + matching totals. |
| 9.2 Total Admissions / 9.3 Potential / In-Bucket / 9.4 Approved Expenses | **PASS (live)** | 10 / ₹11,40,000 / ₹0 / ₹0 with drill. |
| 9.5 profit formula + breakdown | **PASS (live)** | Received ₹4,70,000 − Expenses ₹0 − Incentives ₹0 = Profit ₹4,70,000. |
| 9.6 College Revenue / College Slab label | **PASS (live)** | tab labelled exactly. |
| 9.7 responsive across laptop widths | **PARTIAL / NOT FULLY TESTED** | checked ~1024/800; see §19. |
| 9.9 At-Risk Revenue | **PASS (live)** | ₹0 / 0 admissions. |
| 9.10 Overdue Collections | **PASS (live)** | 0 cases, "View all records". |
| 9.11 Admissions with Pending Fee | **PASS (live)** | 10 / ₹6,70,000 (matches Pending). |
| 9.12 Top Priority Cases initially 5 | **CODE VERIFIED** | list empty in seed (can't show >5). |
| 9.13 More / View All full list | **PASS (live, control)** | "View all records" present per category. |

### §10 Analytics (10.1–10.4)
10.1 KPI cards drill ("View these leads" 31, "View these admissions" 10) **PASS(live)** · 10.2 drill → correct record set **PASS(live)** (→ Lead Store) · 10.3 Year Comparison interactive rows **CODE VERIFIED** (tab present) · 10.4 Total Leads filtered by year **PASS/CODE VERIFIED** (KPIs reflect Period 2026).

### §12 Help & Support (12.1–12.3)
12.1 Total Tickets KPI + 12.2 other KPI drill-downs **PASS(live, clickable)**; data-match **NOT TESTED** (0 tickets in seed) · 12.3 exact ticket navigation **PARTIAL (integration)** — support notification opens Help module, not the ticket; exact-ticket deep-link on af5c254 (unmerged) · ticket visibility restrictions **CODE VERIFIED**.

### §14 Profile & Preferences (14.1–14.7, excl. Settings redesign)
14.1 Light / 14.2 Dark / 14.3 System theme **CODE VERIFIED** (theme logic present); live toggle **NOT TESTED** this pass · 14.4 after refresh **CODE VERIFIED** · 14.5–14.7 Business Overview / Team Operations / My Work views **CODE VERIFIED**; whether they have genuinely distinct datasets **DECISION REQUIRED** (naming/labels).

### §15 Billing & Subscription (15.1–15.3)
15.1 Order History above Current Subscription **CODE VERIFIED** · 15.2 invoices/transactions/download **CODE VERIFIED / PARTIAL** (per tracker) · 15.3 company/user authorization **CODE VERIFIED** (billing permission). Live not run (uses real billing records; none synthetic).

### §16 Notifications (16.1–16.5)
16.1 repeated sign-in grouped **CODE VERIFIED** (grouped sign-in on branch) · 16.2 Lead Added/Status alerts **CODE VERIFIED** · 16.3 grouped sign-in details **CODE VERIFIED** · 16.4 calendar reminders visible + 10-min delivery **PASS (API, server-side worker)**; bell **PASS(live)** · 16.5 Web+Android compatibility, nav to records, sounds — **Web lead nav PASS**; **calendar/ticket/finance nav PENDING (unmerged af5c254)**; **Android FCM delivery BLOCKED** (no device); **sound CODE VERIFIED** (pending human).

### §18 User Greetings (18.1–18.3)
18.1 greeting shows logged-in user name **PASS (live)** ("Good Afternoon, A Admin" — user name, not company) · 18.2 Manager/Employee/Admin see own name **PASS/CODE VERIFIED** (binds to `user.name`) · 18.3 morning/evening changes **PASS (live)** (time-based "Good Morning/Afternoon/Evening").

### §19 Global UI (19.1–19.10)
19.1/19.8 KPI drill consistency + exact-record nav **PASS (live)** across Dashboard, Lead Store, Admissions, Finance, Analytics, Counselling, Walk-ins · 19.2 dropdown arrow spacing **PASS (live)** · 19.3 custom Other persistence **PASS (live+API)** (Lead Store) · 19.5 export accuracy **PASS (live+API)** · 19.6 no overlapping modals/dropdowns **PASS (live)** (View closes Filter) · 19.7 role-based UI+backend auth **PASS (API)** (employee/manager/admin scoping) · 19.9 local refresh controls **CODE VERIFIED** · 19.4 responsive @1366/1440/1024/390 **PARTIAL / NOT FULLY TESTED** (modal offset seen ~1024; full matrix not run) · 19.10 mobile notification parity **BLOCKED** (no device) · keyboard/dialog a11y **NOT TESTED** (Track B owns a11y).

### §20 Open decisions
**DECISION REQUIRED** (all): approved college dataset · Course/Interest predefined list · Source dropdown master data · **meaning of IMDM** (drives §3.12) · Lead ID numbering scope · Profit calculation formula · Appearance/System behavior. Not invented or finalized.

---

## F. Android tests
**BLOCKED — none run.** No emulator/device in this session (owned by the mobile-ui track). All mobile/FCM/sound items are BLOCKED or CODE VERIFIED, never PASS.

## D. Automated tests (isolated test DB `bispun_notif_test`, feature-branch run today)
| Suite | Command | Result |
|---|---|---|
| Unit | `npm test` | **106/106 PASS** |
| API integration | `node --test server/__tests__/api.integration.test.js` | **35/35 PASS** |
| Gap closure (locked folders, chats, finance, counselling, session) | `node --test server/__tests__/gapClosure.integration.test.js` | **5/5 PASS** |
| Notification deep-link producers | `node --test server/__tests__/notificationDeeplinks.test.js` | **4/4 PASS** |
| **Total** | | **150/150** |
Build: `npm run build` green previously. No regression observed.

## H. Missing / partial
- CSV **import** file-upload end-to-end + import "Duplicates Skipped" counter — NOT TESTED.
- §3.12 single "IMDM" option — MISSING (split into IM/DM) pending decision.
- §8.1 explicit Domestic/International walk-in KPI split — PARTIAL.
- §6.13 college-by-stream, §6.11/6.12 stream-Other persistence — NOT TESTED / CODE VERIFIED.
- §14 theme live toggle, §15 billing live, §10.3 Year Comparison live — not run this pass.

## I. Bugs (severity)
- **P1 — Calendar reminder notification click does nothing / doesn't open the event** (integration branch). Confirmed live. Fix exists unmerged (af5c254 FE + 621059a BE). Until merged, users clicking a reminder from the Dashboard see no navigation.
- **P2 — Help/Support & finance notifications don't deep-link to the exact record** (integration). Open the module only. Fix on af5c254 (unmerged).
- **P3 — Add Lead / Import modal renders shifted under the sidebar ~1024px** (cosmetic; functional).
- **P3 — React dev warning** "key prop spread into JSX" at `Dashboard.jsx:283` (dev-only).

## J. Security / permissions
- Lead visibility correctly role-scoped (admin all, manager team, employee own) — **PASS (live/API)**.
- Tenant isolation `companyId`-scoped on every query + integration tenant-isolation test passes — **PASS**.
- Chat/admission attachment permission enforcement — **CODE VERIFIED** + gap-suite runtime pass.
- No cross-tenant/cross-user leakage observed.

## K. Pending business decisions
§20 items above + §3.12 IMDM + §14 view-naming/dataset distinctness.

## L. Blocked tests (reason)
- Android/FCM/mobile notification + sound audibility — no device/emulator in this session.
- Calendar/ticket/finance notification deep-link end-to-end — FE+BE unmerged (af5c254 / 621059a), not in integration.
- CSV import, billing live, 2-account Join Meet — need file/real-records/second session; and no-write constraint limits new DB records.

## M. Prioritized action plan (safe)
1. **Consolidate & verify notification deep-links** — merge af5c254 (FE) + 621059a (BE) into an integration branch, then re-run the consolidated web+Android verification (fixes P1/P2). Needs approval.
2. **Resolve §20 decisions** (esp. IMDM, college dataset, profit formula) — unblocks §3.12, §6, §9.
3. **Android pass** on emulator/device for §1.7/§16/§19.10/§22-mobile.
4. **Finish live gaps**: CSV import, theme toggle, Year Comparison, stream-by-college, billing — with authorization for synthetic data.
5. Cosmetic: modal responsive offset; remove dev `key`-spread warning.

## N. Module-level summary
| Module | Verdict |
|---|---|
| §1 Dashboard | PASS (1 P1 nav bug; sound/Android pending) |
| §2 Lead ID | PASS |
| §3 Lead Store | PASS (3.12 decision; CSV import not tested) |
| §4 UTM | PASS (fields/nav); creation/persist code-verified |
| §5 Chats | CODE VERIFIED (no destructive test) |
| §6 Admissions | PASS (KPIs/LeadID); stream/college partial; dataset decision |
| §7 Counselling | PASS |
| §8 Walk-ins | PARTIAL (Int'l/Domestic KPI) |
| §9 Finance | PASS |
| §10 Analytics | PASS |
| §12 Help | PASS (clickable); 12.3 partial; data-match untested |
| §14 Profile/Prefs | CODE VERIFIED (decision on views/theme naming) |
| §15 Billing | CODE VERIFIED |
| §16 Notifications | PARTIAL (web lead PASS; deep-links unmerged; Android blocked) |
| §18 Greetings | PASS |
| §19 Global UI | PASS (responsive/a11y/mobile partial) |
| §20 Decisions | DECISION REQUIRED |

## O. Genuinely verified (live/API) vs CODE VERIFIED only
- **Genuinely verified (live/API):** §1.1–1.5, §2.1–2.4, most of §3, §4.1/4.3/4.6/4.8-nav, §6.4–6.8/6.10, §7.1–7.3, §8.2, §9.1–9.6/9.9–9.11/9.13, §10.1/10.2, §12.1/12.2 (clickable), §18, §19 drill/role/overlap/export, role scoping, tenant isolation, duplicate detection.
- **CODE VERIFIED only (runtime not verified here):** §5 all, §6.9/6.11–6.14, §9.12, §10.3, §12.3, §14 all, §15 all, §16.1–16.3, §4.2/4.7, §3.3.
- **BLOCKED:** Android/FCM/sound audibility; notification deep-link end-to-end (unmerged).
- **DECISION REQUIRED:** §20 + §3.12.

_No application source changed. No push/merge/deploy/production change. Synthetic QA data only; no external messages. Excluded §11/§13-UI/§17 per scope._
