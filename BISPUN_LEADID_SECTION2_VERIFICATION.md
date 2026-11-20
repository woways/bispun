# Bispun CRM — Lead ID Format (PDF §2.1–2.4) Verification

**Date:** 2026-11-13 · **Branch:** `integration/bispun-final-pdf-review` (worktree `S:\Bispun-final-review`)
**Env:** isolated local `bispun_final` · backend http://localhost:4200 · frontend http://localhost:5178
**Method:** code trace + authenticated live API test (Client Admin).

## Verdict: ALL 4 IMPLEMENTED AND WORKING

| # | Requirement | Status | Evidence |
|---|---|---|---|
| 2.1 | Replace numeric 1/2/3 with LD001/LD002/LD003 | ✅ WORKING | `leadNumber` 29 → **LD029**, 28 → **LD028**, 27 → **LD027** (format `LD` + 3-digit zero-pad). Identical helper in every module. |
| 2.2 | Every lead has a Lead ID (manual, import, admissions-linked) | ✅ WORKING | Created a lead via the manual API → got `leadNumber` **29 / LD029** instantly. Assignment is by a **DB `BEFORE INSERT` trigger** (`assign_company_lead_number`), so it fires on every creation path (manual, CSV/XLSX import, admissions-linked). Admission sample: every linked admission carries a `leadDisplayId`. |
| 2.3 | Same Lead ID consistent across Lead Store, Lead Details, Action Center, Admissions, exports | ✅ WORKING | Lead `cmweixtlp…9q2yk8` = **LD027** in Lead Store; the admission linked to that same `leadId` also = **LD027**. Earlier §1 test: Action Center LD006 → Lead Details LD006. Exports: Lead Store `exportCurrentView` and Dashboard/Action-Center CSV both emit a **"Lead ID"** column from the same `leadNumber`. |
| 2.4 | Formatted LD is user-facing; internal DB id unchanged | ✅ WORKING | Internal `id` is a **cuid** (`cmweokmre000f10c46b8fw5na`), fully separate from `leadNumber` (29). LDxxx is derived from the dedicated `leadNumber` column; the cuid primary key is untouched. |

## Implementation map
- **Display format** (identical everywhere): `` `LD${String(leadNumber).padStart(3,"0")}` `` — `clientLeads.js`, `clientLeadStore.js`, `clientAdmissions.js`, `clientAnalytics.js`, `clientCounselling.js` (server) and `LeadStore.jsx`, `LeadDetailsView.jsx`, `Admissions.jsx`, `Counselling.jsx`, `Dashboard.jsx` (client).
- **Source of the number:** `Lead.leadNumber` — a per-company integer assigned by a Postgres trigger/function (`assign_company_lead_number`), unique on `(companyId, leadNumber)`. Internal PK `id` is a cuid, never exposed as the user-facing ID.
- **Search:** users can search by the formatted ID — `search.match(/^LD0*(\d+)$/i)` maps `LD027`→`leadNumber 27` (`clientLeads.js`, `clientLeadStore.js`, `LeadStore.jsx`).
- **Cross-module consistency:** modules build one `leadNumberMap` (id→leadNumber) and format from it, so a lead shows the same LD id in every view and export.

## Caveats / notes
- **Production dependency:** the `leadNumber` column + its unique index + the assign-number function/trigger ship via migration **0005P** (`prod_stable_lead_number_nullable.sql`), which is **NOT yet on production** (prod audit shows `leadNumber` missing). Until that migration is applied, production will not have LD IDs. `prisma db push` does **not** create the trigger — the SQL migration must be run. (See `BISPUN-PROD-MIGRATION-RECONCILIATION-20261111.md`.)
- Admissions **not** linked to a lead (direct admissions) correctly show no LD ("Admission record") — they are not leads.
- **Test artifact left behind:** one manual test lead "QA LeadID Test 2.x" (LD029) remains in the disposable `bispun_final` DB (the CRM-create endpoint has no matching API delete route; `/manual/:id` only removes dataset-origin leads). Harmless; delete from the UI if desired.
