# Bispun CRM — PDF Section 3 (Lead Store §3.1–§3.19) Verification

**Date:** 2026-11-13 · **Branch verified:** `integration/bispun-final-pdf-review` (manual env `S:\Bispun-final-review`, servers :5178 / :4200, isolated local `bispun_final`)
**Method:** code inspection + LIVE browser + API/DB on the isolated local QA DB. Synthetic QA leads only. No external WhatsApp/SMS/email/push/payment. No push/merge/deploy/production change.
**Status legend:** PASS (live/API verified) · PARTIAL · FAIL · BLOCKED (needs business decision) · NOT TESTED.

## Notification work — PRESERVED (not part of Section 3; reopened after Track B FE)
- Backend commits: **`621059a`** (fix) + **`963941a`** (report) on branch **`qa-fix/notification-deeplinks-backend`** (worktree `S:\Bispun-notif`). Not pushed/merged.
- Contract agreed with Track B (confirmed, no changes): `actionModule = moduleKey ["#" targetType ":" targetId]` → `dashboard#event:<id>`, `help#ticket:<id>`, `lead-store#lead:<id>`. Documented in `BISPUN_NOTIFICATION_DEEPLINK_BACKEND_REPORT.md` + `BISPUN_NOTIFICATION_NAV_AUDIT.md`.
- **Web/Android notification navigation = PENDING** (Track B frontend deferred to their Phase 2; consolidated verification reopens when their FE branch lands). NOT marked PASS.
- Track B's active files (notificationTarget.js, ClientPortal.jsx, Dashboard.jsx, Help.jsx, mobilePush.js) left untouched.

---

## Section 3 results (live + API verified on isolated `bispun_final`)

| § | Requirement | Status | Evidence |
|---|---|---|---|
| 3.1 | Lead Store View & Filter controls never overlap | **LIVE PASS** | Opening View auto-closed the Filter panel (and the reverse); never stacked. |
| 3.2 | Interested College field saved | **LIVE+API PASS** | Field present in Add Lead ("e.g. VNR VJIET, CBIT"); created lead persisted `preferredColleges:"VNR VJIET, CBIT"`. |
| 3.3 | Lead Details Activity History Refresh | **PARTIAL** (code + behavior) | Refresh control in `LeadDetailsView.jsx:414`; remark-after-refresh proven in 3.4. Live button-click not screenshotted. |
| 3.4 | Remark shows after refresh | **API PASS** | POST remark → 201; refetch shows `remarks.length=1`, "QA remark one". |
| 3.5 | Lead Store KPI cards clickable | **LIVE PASS** | Clicked Converted (10) → "LEAD STORE KPI — Showing Converted Leads" filter + reset. |
| 3.6 | Course/Interest dropdown + Other | **LIVE PASS** | Options: B.Tech…Nursing, **Other**. |
| 3.7 | Other → free-text saved | **LIVE+API PASS** | Course=Other revealed free-text; persisted `course:"Data Science (QA Other)"`. |
| 3.8 | Lead Source dropdown + Other | **LIVE PASS** | Source list + **Other** → revealed "custom source" free-text. |
| 3.9 | Lead Source values list | **LIVE PASS** | Website, Google Form, Google Ads, Meta, Referral, Walk-in, Expo, WhatsApp, Call, Partner, Organic, Purchased Data, Other. |
| 3.10 | Dropdown arrow alignment (inset) | **LIVE PASS** | Chevrons inset/right-aligned on all selects (Add Lead, Filter, Import). |
| 3.11 | Same dropdowns in Import Leads | **LIVE PASS** | Import modal has Default Course/Interest + Source dropdowns. |
| 3.12 | Move origin/type from UTM incl. "IMDM" | **PARTIAL / BLOCKED** | Implemented as **IM Leads + DM Leads as two separate categories**, not one literal "IMDM" option. Deviation — needs a business decision on whether a single "IMDM" option is required. |
| 3.13 | Import Lead Type categories | **LIVE PASS** | Import "Type" dropdown (External Data …) mirrors the lead-type list. |
| 3.14 | Add Lead type list | **LIVE PASS** | 12 categories (Individual, External Data, Offline LeadGen, Purchased, Uploaded, Assigned, Google Form, Website Form, IM Leads, DM Leads, Internal Leads). |
| 3.15 | Smart Nurture WhatsApp-only | **LIVE PASS** | "Automated WhatsApp follow-up sequences · WhatsApp template → Follow-up task → Manager alert"; no email step. |
| 3.16 | Stable Lead IDs | **PASS** (prior §2 + this run) | New lead received a `leadNumber`→LDxxx; cuid id separate. |
| 3.17 | No false green on 0 processed | **LIVE PASS** | "Process due now" with 0 due → neutral info "No nurture actions are due right now." (not green). |
| 3.18 | Neutral empty-state wording; CSV import/export | **LIVE PASS** (wording, export, import UI); file-upload **NOT TESTED** | Export CSV verified (9 cols × rows); Import modal present ("CSV/XLSX rows become real CRM leads", 5MB/5000 rows). Actual CSV file upload + import duplicate-skip counter not exercised (needs a crafted file). |
| 3.19 | Green only when ≥1 processed | **LIVE PASS** | 0-processed path showed neutral, no green banner. |
| — Lead search (#17) | **LIVE + API PASS** | Lead Store search box "Search lead ID, name, phone, email or course…"; `?search=LD027`/phone resolves (prior). |
| — Duplicate detection (#14) | **API PASS** | Manual create with existing phone → 409 "A lead already exists with this phone number." (Import-path "Duplicates Skipped" KPI = code-verified variant.) |
| — Employee assigned-lead visibility (#19) | **LIVE/API PASS** | Admin sees 17 lead-store leads; Manager & Employee see 0 (all unassigned) — server-side `getLeadVisibilityScope`. |
| — Permissions (3 roles) | **API PASS** | Role-scoped visibility (admin=all, manager=team, employee=own). |
| — Tenant isolation | **API PASS** (suite) + code | Every query `companyId`-scoped; api.integration tenant-isolation test passes (35/35). |

### Regression (isolated test DB, feature-branch run earlier today)
Unit **106/106**, API integration **35/35**, gap **5/5** = **146/146**; no regression. (Lead Store list/create/search/visibility exercised by the integration suite.)

### Confirmed issues / deviations
- **§3.12 IMDM (PARTIAL/BLOCKED):** "IM Leads" and "DM Leads" are two separate dropdown categories; there is no single "IMDM" option. If the PDF requires one combined "IMDM", this is a gap needing a product decision. No safe code fix without that decision.
- **Add Lead / Import modal responsive offset (minor):** at ~1024px the modal renders shifted under the left sidebar (left edge overlaps). Functional but visually clipped — cosmetic; Track B owns UI.
- **Lead name rejects digits** (by design): `isValidManualLeadName` blocks numerals — worth confirming this matches intended business rule for names like "Batch 2026".

### Not tested (needs follow-up)
- Actual CSV/XLSX file upload end-to-end + the import "Duplicates Skipped" counter incrementing (needs a crafted synthetic file).
- §3.3 Activity History Refresh button live click (behavior inferred from remark persistence).
- Cross-tenant live (verified via passing integration tenant test + code, not a separate live 2-tenant UI check).

### Synthetic test data left in `bispun_final` (disposable)
Leads: "QA Persist Lead" (phone 9000000302, course "Data Science (QA Other)", college "VNR VJIET, CBIT", 1 remark) + earlier LD029/LD030. No external messages sent.

---

## Beginner-friendly manual test guide — Lead Store (for the human)
Open **http://localhost:5178**, sign in as Client Admin (`it.admin@qa-a.local`, password in `.manual-qa-credentials.txt`), click **Lead Store** in the left menu.

**Test 1 — KPI card drill-down (§3.5).** *What:* the four cards (Import Batches / Imported Leads / Converted / Duplicates Skipped) are clickable filters. *Why:* jump straight to the records behind a number. *Where:* click the **Converted (10)** card. *Expect:* a "Showing Converted Leads" banner + the list narrows to converted leads. *Pass if:* banner appears and a "Show all leads" reset is shown. *Screenshot:* the filtered list with the banner.

**Test 2 — Add a lead with Course=Other + Interested College (§3.2/3.6/3.7).** *What:* create a lead manually. *Where:* **Add Lead** button. *Enter:* Name "QA Demo Lead" (letters only — digits are rejected), Phone 9000000911, Course/Interest = **Other** then type "Data Science", Interested College "VNR VJIET, CBIT", Source = **Other** then a custom source, Lead Type Individual. Save. *Expect:* "Lead added successfully"; reopen the lead and the custom course + college are still there. *Pass if:* both custom values persist after refresh. *Screenshot:* the saved lead details.

**Test 3 — View vs Filter don't overlap (§3.1).** *Where:* click **Filter** (panel opens), then click **View**. *Expect:* the Filter panel closes when View opens (and vice-versa). *Pass if:* only one panel is ever open. *Screenshot:* View open with Filter closed.

**Test 4 — Smart Nurture is WhatsApp-only + honest counts (§3.15/3.17-3.19).** *Where:* **Smart Nurture** → **Process due now** (with no sequences). *Expect:* a neutral grey message "No nurture actions are due right now." — **not** a green success. *Pass if:* the message is neutral (no green) when nothing was processed. *Screenshot:* the neutral banner.

**Test 5 — Duplicate detection (#14).** *Where:* Add Lead with a phone that already exists. *Expect:* "A lead already exists with this phone number." *Pass if:* the duplicate is blocked. *Screenshot:* the error.

**Test 6 — Lead search (#17).** *Where:* the search box "Search lead ID, name, phone, email or course…". *Enter:* a Lead ID like `LD027` (or a phone). *Expect:* the matching lead(s) appear. *Pass if:* search by LD id and by phone both work. *Screenshot:* the search result.

**Test 7 — Employee visibility (#19).** *Where:* sign out, sign in as Employee (`it.employee@qa-a.local`), open Lead Store. *Expect:* only leads assigned to that employee appear (none, if nothing is assigned). *Pass if:* the employee does NOT see unassigned/other users' leads. *Screenshot:* the employee's Lead Store.

**Test 8 — CSV export/import (§3.18).** *Export:* Lead Store → **Export CSV** → open the file; it should list the visible leads with a Lead ID column. *Import:* **Import Leads** → choose a small CSV with Name + Phone columns → import; new leads appear and duplicates are counted under "Duplicates Skipped". *Pass if:* export opens with data and import creates leads. *Screenshot:* the exported CSV and the post-import KPI counts.

