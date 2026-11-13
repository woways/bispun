# Bispun CRM — PDF Requirements Traceability Matrix

**Source of truth:** `Bispun_Changes.pdf` (12 pages, 21 sections — the "Consolidated Portal Change Request", 7 Nov 2026). *(No `Bispun_Changes(3).pdf` exists on disk; `Bispun_Changes.pdf` is the only requirements PDF present and is used here.)*
**Code assessed against:** `origin/main` = `8dff6d1` (verified 2026-11-12).
**Local runtime verification:** isolated Postgres `bispun_qa` + 35-case API integration suite (this session) + 106 unit tests.
**Method:** code evidence gathered with file:line citations (4 parallel code-audit passes), cross-checked against the deployed production bundle and backend.

## Status legend (per the requested taxonomy)
- **Code status (main):** IMPLEMENTED / PARTIAL / ABSENT — exists in `origin/main` source.
- **Local-verified:** ✅ = behaviour exercised at runtime by this session's automated suite; 🔍 = verified by code inspection only (no runtime UI test); — = n/a.
- **Prod:** every code item below is subject to the **production caveat** (see §0): the **frontend deployed at bispun.com is a stale build that does NOT contain these changes**, so nothing here is "verified working in production." Backend routes are present.

## Status dimensions (2026-11-13 re-verification — read with every row)
Each row's verdict uses PASS / PARTIAL / FAIL / BLOCKED / NOT TESTED. The five "where does it exist" dimensions the spec asks for are **uniform across the matrix** unless a row says otherwise, so they are stated once here instead of repeated per row:
- **Available locally:** yes for every IMPLEMENTED/PARTIAL row (code present in the worktree).
- **Integrated on review branch (`integration/bispun-final-pdf-review`):** yes — this branch = `origin/main` + Track B (mobile/a11y/greeting) + QA suites + admin-reset + **counselling P1 fix**. Exceptions (NOT integrated, held): referral-signup `fa0518f` (§11.3 auto `?ref`), coupon (§17).
- **Present in GitHub `main` (`8dff6d1`):** yes for IMPLEMENTED rows EXCEPT the counselling P1 fix (model field — on this branch only), §11.3 auto-`?ref` (unmerged branch), and the ABSENT items (15.1, 16.3, 17.2).
- **Verified deployed (production):** **NO for all** — the Vercel frontend is a stale build (§0); backend routes present but UI absent.
- **Actually working in production:** **NOT TESTED / BLOCKED for all** — needs authenticated prod access + a redeploy (you run this via the Manual QA Guide).
- **Browser verification status:** **NOT TESTED for all rows here** — no browser/UI runtime was driven in this backend QA; `BISPUN_MANUAL_QA_GUIDE.md` + `BISPUN_MASTER_MANUAL_QA.csv` are the instruments for your per-module browser testing (they carry per-row navigation/action/expected + Actual/Pass-Fail fields).
- **Next action:** per `BISPUN_FINAL_GO_NO_GO.md` §7 (merge held items, resolve §20 business decisions, fix Render `db push`, apply prod migrations incl. counselling `0010`, redeploy frontend, then run the manual matrix).
- **Automated re-verification today:** unit 106/106, API integration 35/35, five-gap 5/5, build green (see `BISPUN_REGRESSION_RESULTS_20261113.md`). "✅" rows are backed by these runs; "🔍" rows remain code-only until browser/manual testing.

---

## 0. OVERARCHING PRODUCTION CAVEAT (applies to every row)

| Dimension | State |
|---|---|
| Code in `origin/main` | current (this matrix) |
| **Prod frontend (Vercel, bispun.com)** | **STALE build `index-CPawhHV9.js`** — PDF change strings absent (verified). Users do NOT see these changes. |
| Prod backend (Render, consulbuzz-api.onrender.com) | recent main; feature routes present (401) |
| Prod DB (Neon, cited operator evidence) | behind: `leadNumber` + `AccountDeletionRequest` absent → stable Lead ID & deletion persistence non-functional in prod |

→ Therefore, across the whole matrix: **"present on production" = NO (frontend) / partial (backend)**, **"verified working in production" = NO / BLOCKED** (needs authenticated prod access, which the user will run via the manual guide). The per-row status is the **code/local** status.

---

## 1. Dashboard
| Req | Code (main) | Local | Evidence |
|---|---|---|---|
| 1.1 KPI cards clickable → drill | IMPLEMENTED | 🔍 | Dashboard.jsx:1295 `openKpiDetail(metric)`, MetricCard as `<button>` :167; backend `GET /dashboard/kpi/:key` clientAnalytics.js:1033 |
| 1.2 Payments Pending shows Lead ID | IMPLEMENTED | 🔍 | Dashboard.jsx:2398 `Lead ID {record.leadDisplayId}`; clientAnalytics.js:1564 |
| 1.3 Action Center lead → exact Lead Details | IMPLEMENTED | 🔍 | Dashboard.jsx:518 `onOpenLead`; ClientPortal.jsx:602 route; LeadStore.jsx:3364 focus id |
| 1.4 Export above Action Center lists | IMPLEMENTED | 🔍 | Dashboard.jsx:2327/2380 `exportActionDetail`→downloadCsv:465 |
| 1.5 reminder 10 min before | IMPLEMENTED | 🔍 | calendarReminders.js:3 `CALENDAR_REMINDER_MINUTES=10`, window :55-68 |
| 1.6 audible alert sound (web) | IMPLEMENTED | 🔍 | ClientPortal.jsx:1827 playNotificationSound; sound.js:49-87 WebAudio |
| 1.7 reminder + sound on mobile | IMPLEMENTED | 🔍 | mobilePush.js:199 REMINDER→playNotificationSound |

## 2. Global Lead ID
| Req | Code (main) | Local | Evidence |
|---|---|---|---|
| 2.1 LD001-style IDs | IMPLEMENTED | ✅ | formatLeadDisplayId clientLeads.js:429 `LD${pad(n,3)}`; **runtime-verified: created lead → leadDisplayId "LD001"** |
| 2.2 every lead has ID (manual/import/admission) | IMPLEMENTED | ✅ | trigger assigns on all inserts; admissionsLeadSync.js:91; **runtime: 41/41 leads numbered, 0 NULL** |
| 2.3 same ID across modules | IMPLEMENTED | ✅ | single `leadNumber` used in leads/leadstore/admissions/analytics/counselling |
| 2.4 internal cuid preserved | IMPLEMENTED | ✅ | schema.prisma:678 `id @default(cuid())`; leadNumber additive |
| **Trigger location** | ⚠️ RISK | ✅ | trigger `Lead_assign_lead_number` is ONLY in `pending-migrations/0005*.sql`, **not** in schema.prisma → `prisma db push` does NOT create it. **Runtime-verified locally** after manual apply. **Prod: absent (see Production Audit §4).** |
| Concurrent-create uniqueness | IMPLEMENTED | 🔍(cited) | `pg_advisory_xact_lock` in 0005; prior isolated test showed distinct numbers on bulk insert |

## 3. Lead Store
| Req | Code (main) | Local | Evidence |
|---|---|---|---|
| 3.1 View/Filter never overlap | IMPLEMENTED | 🔍 | LeadStore.jsx:4972 Filter closes View & vice-versa |
| 3.2 Interested College saved | IMPLEMENTED | 🔍 | LeadStore.jsx:1296 bound to `form.preferredColleges`; Lead.preferredColleges (0004) |
| 3.3 Activity History Refresh button | IMPLEMENTED | 🔍 | LeadDetailsView.jsx:414 refreshActivity (local) |
| 3.4 remark shows after refresh | IMPLEMENTED | 🔍 | LeadStore.jsx:898 addRemark→setRemarks |
| 3.5 Lead Store KPI cards clickable | IMPLEMENTED | 🔍 | LeadStore.jsx:4757-4831 Import Batches/Imported/Converted/Duplicates |
| 3.6 Course/Interest dropdown + Other | IMPLEMENTED | 🔍 | COURSE_OPTIONS :150; Field :1257 |
| 3.7 Other → free-text saved | IMPLEMENTED | 🔍 | courseOther :786 |
| 3.8 Source dropdown + Other | IMPLEMENTED | 🔍 | LeadStore.jsx:1363 select + Other |
| 3.9 Source values list | IMPLEMENTED | 🔍 | SOURCE_OPTIONS :133 |
| 3.10 arrow inset (Lead Type, Assign To) | IMPLEMENTED | 🔍 | CSS :4609 `appearance:none;padding-right:36px` chevron |
| 3.11 same in Import Leads | IMPLEMENTED | 🔍 | Import reuses options :1875/2390 |
| 3.12 move origin/type from UTM (Internal, Google Form, Website, IMDM) | **PARTIAL** | 🔍 | TYPES :60-110 has Internal/Google Form/Website + **IM Leads + DM Leads** separately; **no literal "IMDM"** single option (deviation — see §20.4) |
| 3.13 Import Type keeps + adds Google/Website/IMDM | IMPLEMENTED | 🔍 | TYPES retains External/Offline/Purchased/Uploaded + adds (IMDM as IM+DM) |
| 3.14 same list in Add Lead | IMPLEMENTED | 🔍 | ALL_LEAD_TYPES :125 |
| 3.15 Smart Nurture WhatsApp-only | IMPLEMENTED | 🔍 | NurtureCenter.jsx:21 WhatsApp-only; no email step built |
| 3.16 email kept elsewhere | IMPLEMENTED | 🔍 | nurtureEngine.js:204 sendEmailStep intact |
| 3.17 no false green on 0 processed | IMPLEMENTED | 🔍 | NurtureCenter.jsx:250 `if processed>0` else info |
| 3.18 neutral empty-state wording | IMPLEMENTED | 🔍 | :187/:255 exact PDF wording |
| 3.19 green only when ≥1 processed | IMPLEMENTED | 🔍 | :252 emerald banner gated |
| Clar: Data Sets=Import Batches | IMPLEMENTED | 🔍 | relabeled LeadStore.jsx:4758/4841 |
| Clar: Duplicates KPI | IMPLEMENTED | 🔍 | "Duplicates Skipped" :4824 |
| Clar: Processed view | PARTIAL | 🔍 | no standalone Processed view; surfaced as run banner text only |

## 4. UTM Leads — ALL IMPLEMENTED
| Req | Code | Local | Evidence |
|---|---|---|---|
| 4.1 source/type removed from UTM | IMPLEMENTED | 🔍 | UTMLeads.jsx (fields gone); moved to Lead Store |
| 4.2 Influencer Name on generate | IMPLEMENTED | 🔍 | UTMLeads.jsx:1814 |
| 4.3 Influencer Name on manual add | IMPLEMENTED | 🔍 | UTMLeads.jsx:1969 |
| 4.4 Influencer Name stored | IMPLEMENTED | 🔍 | clientLeads.js:2225; UtmLink.influencerName (0003) |
| 4.5 Medium dropdown | IMPLEMENTED | 🔍 | UTMLeads.jsx:633 |
| 4.6 Medium values | IMPLEMENTED | 🔍 | UTM_MEDIUM_OPTIONS :41 |
| 4.7 Other medium saved | IMPLEMENTED | 🔍 | resolveUtmMedium :54 |
| 4.8 UTM KPI drill-downs | IMPLEMENTED | 🔍 | UTMLeads.jsx:2442 KpiDetail modal |

## 5. Chats — ALL IMPLEMENTED
| Req | Code | Local | Evidence |
|---|---|---|---|
| 5.1 single+multi delete, permissioned | IMPLEMENTED | 🔍 | ChatPanel.jsx:290 canDeleteChats; clientChat.js:1246/1217 requireChatDelete |
| 5.2 Client Admin controls chat-delete perm | IMPLEMENTED | 🔍 | PermissionTree.jsx:343 chat.deleteChats |
| 5.3 disabled → hidden + 403 | IMPLEMENTED | 🔍 | UI gated :1556/1687; backend 403 :24-30 |
| 5.4 Join Meet = one shared session | IMPLEMENTED | 🔍 | clientChat.js:244 reuses cached meet within window |
| 5.5 no per-participant link | IMPLEMENTED | 🔍 | single cached link per conversation |

## 6. Admissions — ALL IMPLEMENTED (+ locked folder)
| Req | Code | Local | Evidence |
|---|---|---|---|
| 6.1 attachment permission | IMPLEMENTED | ✅ | pageAccess admissions.attachments; **runtime: locked folder auto-provisioned, admin-only** |
| 6.2 college/stream visibility perms | IMPLEMENTED | 🔍 | pageAccess.js:158 applyAdmissionScope |
| 6.3 KPI cards clickable | IMPLEMENTED | 🔍 | Admissions.jsx:3357-3403 |
| 6.4 KPI opens admissions | IMPLEMENTED | 🔍 | AllAdmissionsView :3528 |
| 6.5 admission linked to Lead ID | IMPLEMENTED | ✅ | clientAdmissions.js:3006 phone→lead link; **runtime: admission create persisted w/ leadId** |
| 6.6 reuse/independent lead | IMPLEMENTED | 🔍 | :2981 reuse; ensureAdmissionsLead :3045 |
| 6.7 "Admission Done" status | IMPLEMENTED | 🔍 | :3151 stage ADMITTED + leadStatus "Admission Done" |
| 6.8 Stream dropdown + Other | IMPLEMENTED | 🔍 | Admissions.jsx:659 |
| 6.9 stream groups | IMPLEMENTED | 🔍 | BASIC_STREAM_OPTIONS :54 |
| 6.10 Other stream saved | IMPLEMENTED | 🔍 | :669 |
| 6.11 college list depends on stream | IMPLEMENTED | 🔍 | CollegeModal :781; partners streamId-scoped. **Uses company's own partner data, not an external master (see §20.1).** |
| 6.12 "University Name / Affiliation Name" | IMPLEMENTED | 🔍 | Admissions.jsx:2056 |

## 7. Counselling — ALL IMPLEMENTED
| 7.1 KPI cards clickable | IMPLEMENTED | 🔍 | Counselling.jsx:488 |
| 7.2 KPI shows sessions | IMPLEMENTED | 🔍 | :454 metricFilter |
| 7.3 "Video Call"→"Online Meet" | IMPLEMENTED | 🔍 | :79/:99 label map |
| 7.4 dropdown arrow spacing | IMPLEMENTED | 🔍 | `.counselling-select` :461 |

## 8. Walk-ins
| 8.1 KPI cards clickable (Intl/Domestic) | **PARTIAL** | 🔍 | cards clickable Walkins.jsx:440-467, **but International/Domestic is a market TAB (:183), not a KPI card** — deviation from literal wording |
| 8.2 KPI shows records | IMPLEMENTED | ✅ | :394 metricFilter; **runtime: walk-in create+list verified** |

## 9. Finance
| 9.1 KPI cards clickable | IMPLEMENTED | 🔍 | Revenue.jsx:2417-2578 openKpi |
| 9.2 Total Admissions drill | IMPLEMENTED | 🔍 | :2419 |
| 9.3 Potential Revenue breakdown | **PARTIAL** | 🔍 | :2436 shows **admissions + amounts only; no leads breakdown** (PDF says "leads/admissions") |
| 9.4 In-Bucket Revenue | IMPLEMENTED | 🔍 | :2456 |
| 9.5 Approved Expenses | IMPLEMENTED | 🔍 | :2496 EXPENSE_COLUMNS |
| 9.6 Profit breakdown+formula | IMPLEMENTED | 🔍 | :2564 "Received − Approved expenses − Incentives" |
| 9.7 "College Revenue / College Slab" | IMPLEMENTED | 🔍 | Revenue.jsx:2589 |
| 9.8 laptop responsiveness | IMPLEMENTED | 🔍(code-only) | responsive grid :2417 (not runtime-verified at widths) |
| 9.9 At-Risk KPI cards clickable | IMPLEMENTED | 🔍 | :1511-1527 |
| 9.10 Overdue Collections all records | IMPLEMENTED | 🔍 | :1554 full items |
| 9.11 Pending Fee all | IMPLEMENTED | 🔍 | :1522 |
| 9.12 Top 5 + More/View All | IMPLEMENTED | 🔍 | :1666 slice(0,5) + :1702 View all |
| 9.13 View All full list | IMPLEMENTED | 🔍 | :1707 |
| finance-changes branch | n/a | — | **no missing work** — content identical to main |

## 10. Analytics — ALL IMPLEMENTED
| 10.1 KPI cards clickable | IMPLEMENTED | 🔍 | Analytics.jsx:457 onDrill |
| 10.2 Year Comparison rows interactive | IMPLEMENTED | 🔍 | :593-655 per-cell onDrill |
| 10.3 Total Leads per year → leads | IMPLEMENTED | 🔍 | :597 drillKey; clientAnalytics.js:1228 |
| 10.4 other year metrics drill | IMPLEMENTED | 🔍 | :604-635 |

## 11. Referrals
| 11.1 lifecycle Link→Referred→Earned→Credited | IMPLEMENTED | ✅ | ReferralHome.jsx:155; **runtime: no-double-referral(409), no-double-credit verified** |
| 11.2 generate/copy unique link | IMPLEMENTED | 🔍 | ReferralHome.jsx:110 `?ref=${code}` |
| 11.3 signup via link → Referred | **PARTIAL** | 🔍 | **main has only a MANUAL "Enter referrer code" field (SignupPage.jsx:544); automatic `?ref` capture + `src/lib/referralLink.js` exist ONLY on unmerged `origin/feat/referral-signup-lifecycle` (`fa0518f`).** |
| 11.4 earned amount visible | IMPLEMENTED | ✅ | referralRewards.js:48 |
| 11.5 5–8 day expectation | IMPLEMENTED | 🔍 | CREDIT_EXPECTATION_DAYS {5,8} |
| 11.6 client read-only credit | IMPLEMENTED | 🔍 | ReferralHome.jsx:477 |
| 11.7 Super Admin credit control | IMPLEMENTED | ✅ | adminReferrals.js:203 /credit |
| 11.8 "Amount credited" notification | IMPLEMENTED | 🔍 | adminReferrals.js:273 createReferralCreditedNotification |
| 11.9 old payout controls removed | IMPLEMENTED | 🔍 | no client payout POST |
| no-double-credit | IMPLEMENTED | ✅ | referralRewards.js:27 resolveCreditAmount ceiling; **runtime-verified (over-credit rejected)** |

## 12. Help & Support — ALL IMPLEMENTED (PR #22 in main)
| 12.1 KPI cards clickable | IMPLEMENTED | 🔍 | Help.jsx:1651 openTicketDrill |
| 12.2 Total Tickets → full list | IMPLEMENTED | 🔍 | :1651 |
| 12.3 other support KPI drill | IMPLEMENTED | 🔍 | :1671-1711 |

## 13. Settings & Permissions — ALL IMPLEMENTED
| 13.1 user-level perms, Client Admin controls | IMPLEMENTED | ✅ | pageAccess.js:129; clientUsers.js; **runtime: role gating verified (employee 403, manager/admin paths)** |
| 13.2 covers chat/attachments/college/stream | IMPLEMENTED | 🔍 | PermissionTree.jsx:17-46 |
| 13.3 frontend + backend enforcement | IMPLEMENTED | ✅ | UI gates + server 403/where-fragment; **runtime: tenant isolation + perm 403 verified** |
| 13.4 Lead Source setting connected | IMPLEMENTED | 🔍 | clientLeadSources.js ↔ LeadSourceConfig (kept, wired) |

## 14. Profile & Preferences — ALL IMPLEMENTED
| 14.1 Light/Dark/System | IMPLEMENTED | 🔍 | ClientPortal.jsx:3162 |
| 14.2 System follows OS | IMPLEMENTED | 🔍 | :1043 matchMedia listener |
| 14.3 System-light bug fixed | IMPLEMENTED | 🔍 | :1049 resolves to OS |
| 14.4 view rename | IMPLEMENTED | 🔍 | :943 "Business Summary" (PR#22) |
| 14.5 view intents | IMPLEMENTED | 🔍 | :938-977 descriptions |
| 14.6 remove undifferentiated views | IMPLEMENTED | 🔍 | role-pruned :938 |
| 14.7 labels Business Summary/Team Activity/My Workspace | IMPLEMENTED | 🔍 | :943/948/953 |

## 15. Billing & Subscription
| 15.1 Order History card ABOVE Current Subscription | **ABSENT** | 🔍 | **no "Order History" card; order is Current Subscription → Pricing → "Recent Payments" (BELOW).** Feature gap. |
| 15.2 Order History → purchases/invoices/txn | **PARTIAL** | 🔍 | per-txn "View Receipt"/BillingReceiptModal exist via "Recent Payments", **not a labeled Order-History entry point** |
| 15.3 view/download invoices | IMPLEMENTED | 🔍 | BillingReceiptModal.jsx:130 downloadInvoicePdf |

## 16. Notifications
| 16.1 reduce repeated sign-in notifs | **PARTIAL** | 🔍 | clientAuth.js:808 sign-in notif only when concurrent session, **but each still a separate row; no grouping/throttle** |
| 16.2 operational notifs preserved | IMPLEMENTED | 🔍 | lead/billing notifications intact |
| 16.3 one grouped sign-in entry w/ count | **ABSENT** | 🔍 | no grouping/count aggregation found |
| 16.4 sign-ins don't bury important | PARTIAL | 🔍 | volume reduced only; no prioritization |
| 16.5 reminders+10-min sound synced web/mobile | PARTIAL | 🔍 | reminder+web sound+push exist; unified web/mobile sync not evidenced as one mechanism |

## 17. Coupon & Referral Codes
| 17.1 built-in referral/coupon code | **PARTIAL** | 🔍 | referral codes exist; **"coupon" absent entirely** (0 matches) |
| 17.2 codes apply discount | **ABSENT** | 🔍 | no code→discount-at-checkout path; discount is admin-set |
| 17.3 rules need business definition | BLOCKED (by design) | — | §20.8 open decision |

## 18. Personalized Greetings — **DEFECT**
| 18.1 greeting uses user's own name | **ABSENT (DEFECT)** | 🔍 | Dashboard.jsx:1169 `tenant?.name || tenant?.brandName || user?.name || …` → **company name first** |
| 18.2 each role sees own name | **ABSENT (DEFECT)** | 🔍 | same tenant-first expression for all roles |
| 18.3 company brand not in personal greeting | **CONTRADICTED** | 🔍 | brand dominates greeting |
| **Fix** | prepared on `qa-fix/e2e-20261112` | — | greeting → `user?.name || user?.email || tenant?.ownerName || "there"` (see Final Report) |

## 19. Cross-Portal Standards (reusable)
| 19.1 KPI drill-down standard | IMPLEMENTED | 🔍 | reusable MetricCard/RevenueMetric/openKpi across modules |
| 19.2 drill filtered to exact data | IMPLEMENTED | 🔍 | per-section drill handlers |
| 19.3 dropdown arrow padding | IMPLEMENTED | 🔍 | `.form-input` / `.counselling-select` CSS |
| 19.4 Other-value persistence | IMPLEMENTED | 🔍 | course/source/stream/medium Other paths |
| 19.5 responsive standard | PARTIAL | 🔍(code-only) | responsive classes present; not runtime-tested at all widths |
| 19.6 perms frontend+backend | IMPLEMENTED | ✅ | pageAccess enforced both sides |
| 19.7 exact record navigation | IMPLEMENTED | 🔍 | openLead/focus id |
| 19.8 local refresh | IMPLEMENTED | 🔍 | Activity History refresh |
| 19.9 filtered export w/ Lead ID | IMPLEMENTED | 🔍 | action-center CSV includes Lead ID |
| 19.10 mobile parity for reminders | IMPLEMENTED | 🔍 | mobilePush REMINDER sound |

## 20. Open Decisions — classification
| Req | Classification | Note |
|---|---|---|
| 20.1 college data source | **Still pending business approval** | 6.11 uses company's own partner data; external Indian-college master not wired |
| 20.2 final Course/Interest list | Implemented w/ recommended + Other | dynamic + Other present |
| 20.3 final Source list | Implemented (dynamic via Settings) | LeadSourceConfig master wired |
| 20.4 IMDM meaning | **Incorrectly assumed** | split into IM+DM; PDF said preserve "IMDM" term until defined |
| 20.5 Lead IDs sequential per client vs global | Implemented **per-company** | trigger uses `MAX(leadNumber) WHERE companyId` |
| 20.6 Finance Profit formula | Implemented + exposed | "Received − Approved expenses − Incentives" shown |
| 20.7 System appearance behavior | Implemented (follows OS) | kept all three |
| 20.8 coupon rules | **Still pending business approval** | coupon not built |
| 20.9 event that qualifies Earned + 5-8d window | Partially resolved | CrmReferral SUCCESSFUL = earned; exact qualifying event still product-defined |

## 21. QA Acceptance Checklist (mapped)
| Req | Verdict (code/local) | Note |
|---|---|---|
| 21.1 every KPI opens correct filtered set | IMPLEMENTED | code 🔍; runtime UI not fully exercised |
| 21.2 LD001 IDs identical across modules | IMPLEMENTED ✅ | runtime-verified |
| 21.3 Action Center rows: Lead ID+nav+export | IMPLEMENTED 🔍 | |
| 21.4 reminder 10-min + sound web/mobile | IMPLEMENTED 🔍 | server+web+push; mobile runtime not tested |
| 21.5 View/Filter never overlap | IMPLEMENTED 🔍 | |
| 21.6 Interested College/Course/Source/Other persist | IMPLEMENTED 🔍 | |
| 21.7 Smart Nurture WhatsApp-only, no false green | IMPLEMENTED 🔍 | |
| 21.8 UTM Influencer+Medium stored, KPI drill | IMPLEMENTED 🔍 | |
| 21.9 chat delete permission; same Meet | IMPLEMENTED 🔍 | |
| 21.10 admission perms restrict attachments/colleges/streams | IMPLEMENTED ✅ | runtime: locked folder + perms |
| 21.11 shared Lead ID + Admission Done sync | IMPLEMENTED ✅/🔍 | |
| 21.12 Finance drill-downs + More/View All | IMPLEMENTED 🔍 | (9.3 partial) |
| 21.13 Referrals lifecycle + Super Admin credit | IMPLEMENTED ✅ | (11.3 partial — signup attribution unmerged) |
| 21.14 Lead Source connected or removed | IMPLEMENTED 🔍 | connected |
| 21.15 System appearance verified/removed | IMPLEMENTED 🔍 | follows OS |
| 21.16 Order History exposes invoices | **FAIL** | **15.1 ABSENT** — no Order History card |
| 21.17 sign-in notifs grouped/reduced | **PARTIAL/FAIL** | reduced but **not grouped (16.3 absent)** |
| 21.18 greetings use logged-in user name | **FAIL** | **§18 DEFECT** (company name) — fix prepared |
| 21.19 dropdown arrows + responsive consistent | IMPLEMENTED 🔍 | responsive not runtime-tested at widths |

---

## Summary counts (code in `origin/main`)
- **IMPLEMENTED:** ~  the large majority (§1,2,4,5,6,7,9*,10,11*,12,13,14,19).
- **PARTIAL:** 3.12 (IMDM split), 3-Processed-view, 8.1 (market tab), 9.3 (no leads breakdown), 11.3 (signup attribution unmerged), 15.2, 16.1, 16.4, 16.5, 17.1, 19.5.
- **ABSENT / FAIL:** 15.1 Order History, 16.3 grouped sign-in, 17.2 coupon discount, **18.1/18.2 greeting (DEFECT)** → acceptance **21.16, 21.17, 21.18 fail**.
- **Blocked by business rules:** 17.3, 20.1, 20.8, 20.9 (parts), 20.4 (deviation).
- **Production:** **NONE verified working in production** (frontend stale); stable Lead ID + deletion **blocked by environment** in prod.
