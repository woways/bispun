# Bispun CRM — Step-by-Step Manual Test Guide (for your own testing)

This guide walks you through testing every PDF requirement **one by one**, in PDF order. It is written for a non-developer. Pair it with `BISPUN_MASTER_MANUAL_QA.csv` (fill the **Actual Result** and **Pass/Fail** columns as you go).

## Before you start — READ THIS
There are **three different places** the app can run, and they are NOT the same right now:
- **Local/Staging (dev):** a safe copy with test data. **Do all WRITE tests here** (adding leads, admissions, etc.).
- **Production frontend:** `https://bispun.com` — **currently a STALE build** that does **not** contain most PDF changes yet. Testing PDF features here will mostly FAIL until it is rebuilt/redeployed. Use production only for **read-only** checks.
- **Production backend/database:** recent code, but the **database is missing the stable-Lead-ID and account-deletion changes** (see the Production Audit). So even some backend features won't work in prod yet.

**Golden rules while testing:**
1. Never enter real customer data or send real emails/SMS/WhatsApp from production.
2. Do all create/edit/delete tests in dev/staging only.
3. For each test: do the action → check the screen → **refresh the page** → check it persisted → check the linked module.
4. A button is **not** "Pass" just because it is clickable — it must open the **correct, filtered** data.
5. Capture a screenshot for anything you mark Fail.

**Login roles to prepare (dev):** one **Client Admin**, one **Manager**, one **Employee**, and (for referrals credit) a **Super Admin**. Many permission tests need you to switch between these.

---

## How to read each test
- **Where:** the menu path.
- **Do:** the exact click/entry.
- **Expect:** what must happen.
- **Then:** refresh + cross-check.
- **Bug if:** what counts as a failure.
- **Screenshot:** what to capture.

---

## Section 1 — Dashboard
**1.1 KPI cards clickable.** Where: Dashboard. Do: click each KPI card (Total Leads, Qualified Leads, etc.). Expect: it opens a list of exactly the records that make up that number (e.g., Qualified Leads shows only qualified leads). Bug if: nothing happens, or it opens an unfiltered list. Screenshot: the opened list with its filter.

**1.2 Payments Pending shows Lead ID.** Where: Dashboard → Action Center → Payments Pending. Expect: every row shows a Lead ID like **LD001**. Bug if: a row has no Lead ID.

**1.3 Action Center lead opens exact lead.** Do: click a lead in Action Center. Expect: it opens **that exact lead's** details in Lead Store. Then: confirm the name/phone matches. Bug if: it opens a generic summary or a different lead.

**1.4 Export above Action Center.** Do: in Payments Pending, click **Export CSV**. Expect: the CSV contains exactly those pending-payment records (with Lead ID, name, phone). Bug if: export is missing, empty, or includes unrelated rows.

**1.5 Reminder 10 minutes before.** Do: create a calendar event for **11 minutes from now**; wait. Expect: a reminder appears ~10 minutes before the event (about 1 minute from now). Bug if: no reminder, or wrong timing. Screenshot: the reminder with the clock visible.

**1.6 Audible alert (web).** Do: keep the portal tab open and focused when the reminder (or any new notification) arrives. Expect: an audible bell/alert sound. Bug if: silent (check volume/tab-muting first).

**1.7 Reminder + sound on mobile.** Do: on the Android app, have the event due. Expect: a push notification with the alert sound. Bug if: no push/sound on mobile.

## Section 2 — Global Lead ID
**2.1 LD001 format.** Where: Lead Store list. Expect: IDs read LD001, LD002… Bug if: plain 1, 2, 3.
**2.2 Every lead has an ID.** Do: (a) add a lead manually, (b) import a CSV of leads, (c) create an admission that makes a lead. Expect: all three get LDxxx IDs. Bug if: any shows blank/numberless. **Note:** this depends on a database trigger — see **Production warning** below.
**2.3 Same ID across modules.** Do: open one lead in Lead Store, then find it in Admissions / Action Center / an export. Expect: identical LDxxx everywhere. Bug if: different IDs.
**Production warning (2.x):** In **production** the stable-ID database trigger is **not installed yet** (migration 0005). So new production leads would show a **blank** Lead ID. Do NOT test lead creation in production. In dev it works (verified).

## Section 3 — Lead Store
**3.1 View/Filter don't overlap.** Do: open **View**, then click **Filter**. Expect: View closes before Filter opens (and vice-versa). Bug if: both menus show at once/overlap.
**3.2 Interested College.** Do: Add/Edit Lead → enter **Interested College** = "IIT Delhi" → Save → refresh. Expect: it persists on the lead. Bug if: not saved/shown.
**3.3 Activity History Refresh.** Where: open a lead → **Activity History** tab → **Refresh**. Expect: only the history refreshes (page doesn't fully reload). 
**3.4 Remark then refresh.** Do: add a remark → Refresh. Expect: the new remark appears immediately.
**3.5 KPI cards clickable.** Do: click **Import Batches**, **Imported Leads**, **Converted**, **Duplicates Skipped**. Expect: each opens its underlying list/panel.
**3.6–3.7 Course/Interest dropdown + Other.** Do: Add Lead → Course/Interest → choose from dropdown (B.Tech/MBA…) and also **Other** → type "Diploma in XYZ" → Save → refresh. Expect: dropdown exists; Other free-text persists.
**3.8–3.9 Source dropdown + Other.** Do: Add Lead → Source dropdown (Website, Google Form, Google Ads, Meta, Referral, Walk-in, …) → choose **Other** → "Expo 2026" → Save. Expect: list present; Other persists.
**3.10 Dropdown arrow inset.** Look at **Lead Type** and **Assign To** selects — the arrow should sit slightly inset, aligned with the box, not jammed at the far edge.
**3.11 Import Leads same UI.** Do: Lead Store → Import Leads → mapping step. Expect: same Course/Source dropdowns, Other handling, and arrow styling.
**3.12–3.14 Lead Type options.** Do: Add Lead and Import → Lead Type dropdown. Expect: Internal Leads, Google Form, Website Form, plus **IM Leads** and **DM Leads**, and External Data/Offline/Purchased/Uploaded. **Bug note:** the PDF asked for a single "**IMDM**" option; the app splits it into "IM Leads" + "DM Leads" (BUG-IMDM — confirm with product whether that's acceptable).
**3.15–3.19 Smart Nurture.** Do: build a Smart Nurture sequence. Expect: **only WhatsApp** (no email steps). Then run nurture with **no eligible lead** → expect a **neutral** message ("No eligible leads selected" / "No nurture actions are due right now"), **not** a green success. Run with an eligible lead → expect a **green success** only then. Also confirm email still works elsewhere in the CRM.

## Section 4 — UTM Leads
**4.1** Confirm UTM no longer has lead-source/type dropdowns. **4.2–4.4** Generate a UTM link and also Add one manually → fill **Influencer Name** → Save → reopen → it persists. **4.5–4.7** Medium is a dropdown (Social, Paid Social, CPC/PPC…); choose **Other** → "Billboard" → persists. **4.8** In UTM Analysis, click KPI cards (UTM Links, Registrations, UTM Leads) → each shows underlying records.

## Section 5 — Chats
**5.1–5.3 Delete permission.** As **Client Admin**: Settings → Users → a Manager/Employee → toggle **chat delete** permission OFF. Log in as that user → the delete action should be **hidden**; if forced via API it returns 403. Toggle ON → delete works (single and multiple). **5.4–5.5 Shared Meet.** Two users in one chat: both click **Join Meet** → both must land in the **same** Google Meet (not two different links).

## Section 6 — Admissions
**6.1 Attachments permission.** As Client Admin, restrict a user's attachment access → that user cannot view/download admission attachments (and cannot see the confidential/locked folder). **6.2 College/Stream visibility.** Scope a Manager to certain colleges/streams → they only see those. **6.3–6.4 KPI cards.** Click Total Admissions / stream cards (e.g., BDS) → opens those admissions. **6.5–6.7 Lead link.** Create an admission (student phone required) → the same **Lead ID** appears in Lead Store, and the lead shows **"Admission Done"**. Creating from an existing lead reuses its ID; an independent admission creates a matching Lead Store record. **6.8–6.10 Stream dropdown + Other.** Add Admission → Stream dropdown (Engineering, Medical, Dental…) + Other ("Aviation") persists. **6.11 College depends on stream.** Add College → pick Engineering → college list filters to that stream. **Note:** this uses your company's own college list, not an external India-wide master (BUG-COLLEGE-MASTER / open decision §20.1). **6.12** Add Admission → the label reads **"University Name / Affiliation Name"**.

## Section 7 — Counselling
**7.1–7.2** Click **Sessions Today** / **Sessions This Week** → shows those sessions. **7.3** In Schedule Session, the mode reads **"Online Meet"** (not "Video Call"). **7.4** Dropdown arrows are inset.

## Section 8 — Walk-ins
**8.2** Click a KPI card → shows the walk-in records behind it. **8.1 (partial):** International/Domestic are **tabs**, not KPI cards — confirm with product if that's acceptable (BUG-WALKIN-KPI). Also confirm Create/Edit/Save and follow-up still work.

## Section 9 — Finance
**9.1–9.6** Click each Finance KPI → drill-down list. For **Profit**, confirm it shows the **formula** ("Received − Approved expenses − Incentives") and the component values. **9.3 (partial):** Total Potential Revenue drill shows admissions+amounts but **no leads breakdown** (BUG-FIN-POTENTIAL). **9.7** The tab reads **"College Revenue / College Slab"**. **9.8** Resize the window to common laptop widths (1280/1366/1440) → no clipping/congestion. **9.9–9.13** At-Risk: click **Overdue Collections** and **Admissions with Pending Fee** → full record lists; **Top Priority Cases** shows 5 then **More/View All** opens the complete list.

## Section 10 — Analytics
**10.1** Click Analytics KPI cards → records. **10.2–10.4** In **Year Comparison**, click **Total Leads** for a specific year → shows that year's leads; repeat for other metrics.

## Section 11 — Referrals
**11.1–11.2** Referrals home shows the four stages (Link → Referred → Earned → Credited); you can **copy a unique link**. **11.3 (partial):** the link has `?ref=CODE`, but **automatic capture on signup is NOT in the current build** — the signup page only has a **manual "enter referrer code" field** (BUG-REF-SIGNUP; the automatic version is on an unmerged branch). Test by having a prospect sign up and entering the code manually; they should appear under **Referred**. **11.4–11.6** Earned amount is visible; a ~5–8 day credit note shows; the client **cannot** mark money credited. **11.7–11.8** As **Super Admin**, mark a referral **Credited** → the client gets an **"Amount credited"** notification. **11.9** Confirm there are no old payout/redeem buttons on the client side. **No double-credit:** try to credit more than earned / click twice → it must be rejected.

## Section 12 — Help & Support
**12.1–12.3** Click Help KPI cards (**Total Tickets**, Open, In Progress, Completed) → each shows the correct tickets. Also create/view/update a ticket (don't send real external support messages in prod).

## Section 13 — Settings & Permissions
**13.1–13.3** As Client Admin, open a user's permissions and toggle: chat delete, admission attachments, college visibility, stream visibility. Log in as that user → the UI hides restricted things **and** the server blocks bypass attempts (403). **13.4** Settings → **Lead Source**: add a source → it appears in Add Lead's Source dropdown (the setting is connected).

## Section 14 — Profile & Preferences
**14.1–14.3** Profile → Appearance: try **Light**, **Dark**, **System**. With System selected, switch your OS theme → the portal follows. **14.4–14.7** Dashboard view switcher shows **Business Summary / Team Activity / My Workspace** with clear descriptions, and the views differ by role.

## Section 15 — Billing & Subscription  ⚠️ EXPECTED FAIL
**15.1 (FAIL):** Billing → Manage Plan & Renewal → there should be an **Order History** card **above** Current Subscription. **It is not implemented** — instead a "Recent Payments" list sits **below**. Mark Fail (BUG-ORDER-HISTORY). **15.3:** You CAN open a payment's **View Receipt** → **Download PDF** invoice (this works).

## Section 16 — Notifications  ⚠️ PARTIAL
**16.2** Trigger a lead add / status change → you get those notifications (works). **16.1/16.3 (partial/fail):** repeated sign-in notifications are reduced (only on a concurrent session) but are **not grouped into one entry with a count** (BUG-SIGNIN-GROUP). **16.5** Calendar reminders + 10-min sound exist on web and via mobile push; confirm on both.

## Section 17 — Coupon & Referral Codes  ⚠️ MOSTLY ABSENT
Referral **codes** exist, but a **coupon-code-applies-discount-at-checkout** feature does **not** (BUG-COUPON). Per the PDF (§17.3 / §20.8), the coupon rules need separate business approval — do not expect this to work.

## Section 18 — Personalized Greetings  ⚠️ DEFECT (fix prepared)
**18.1–18.3:** The dashboard greeting currently shows the **company name** ("Good morning, Student Mentor") instead of **your own name**. This is a confirmed defect (BUG-GREETING). A fix is prepared on the `qa-fix/e2e-20261112` branch (greeting → your name). After the fix is merged + deployed, each role should see "Good morning, <their own name>".

## Section 19 — Cross-Portal Standards
Spot-check across modules: KPI drill-downs open exact filtered data (19.1–19.2), dropdown arrows are consistent (19.3), Other values persist (19.4), permissions enforced both sides (19.6), clicking a summary row opens the exact record (19.7), local refresh works (19.8), exports match the filter and include Lead ID (19.9), reminders work on mobile (19.10). **19.5 responsive:** check 375/390/768/1024/1280/1440 px.

## Section 20 — Open Decisions (confirm with product, don't "fix" in code)
20.1 college master data (pending), 20.4 "IMDM" meaning (app split it — confirm), 20.8 coupon rules (pending), 20.9 exact "Earned" qualifying event (confirm). Others (Lead ID per-company, Profit formula, System theme, Source list) are implemented per recommended defaults.

## Section 21 — Acceptance Checklist
Use the CSV rows 21.x as your final sign-off gate. **Known gates that currently FAIL:** 21.16 (Order History), 21.17 (grouped sign-in), 21.18 (greeting — fix prepared). Everything else is implemented in code (confirm at runtime per the steps above).

---

## Where to test what (quick reference)
| Feature type | Where to test |
|---|---|
| Any create/edit/delete, imports, admissions, referrals credit | **Dev/Staging only** |
| Lead ID generation | **Dev** (prod trigger missing) |
| Read-only "is it live?" checks | Production (but frontend is stale — expect missing features) |
| Emails/SMS/WhatsApp/push | **Dev with dummy recipients only** — never real prod sends |
