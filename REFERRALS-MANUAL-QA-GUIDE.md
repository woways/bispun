# Referrals — Manual QA Guide (beginner-friendly)

Branch `feat/referrals-lifecycle` · commit `c714a7d` (+ QA fixes). PDF §11 (11.1–11.9).

This guide walks you, click by click, through testing the referral feature on **desktop and mobile**.
Do not use real customer accounts or real money. Use the test data below.

---

## 0. Setup (do this once)

| Step | Action |
|---|---|
| 0.1 | Make sure `.env` points at the **Dev** database (not production). Do not share secrets. |
| 0.2 | Apply the migration to Dev: `psql "$DATABASE_URL" -f prisma/pending-migrations/0007_add_referral_credit_audit.sql` then `npm run prisma:generate`. **This is required** — the credit audit columns must exist or the "Mark credited" action will error. |
| 0.3 | Start backend: `npm run server` · Start web: `npm run dev`. |
| 0.4 | Have ready: one **Client Admin** login, one **Manager** login, one **Employee** login (same company), and one **Super Admin** login. |

**Fixtures / seeded data you will need** (flag to the dev team if missing):
- At least one Client Admin with a company (to generate a link).
- To see "Referred/Earned": one or more **referred companies** created via self-serve signup using the Client Admin's referral code (see TC-E2E below). Without these, Earned/Referred will correctly show empty.
- Optional: a legacy `ReferralPayoutRequest` row to test the "Legacy Payout Requests" panel (needs a seeded record; clients can no longer create these).

---

## A. Client Admin — Referral program (Portal → Referrals → "Referral program" tab)

| ID | Navigate / Click | Example data | Why | Expected result | Failure looks like | Verify saved state | Evidence | Pass? |
|---|---|---|---|---|---|---|---|---|
| CA-01 | Portal → left nav → **Referrals** | — | Entry point | Page loads with h1 "Referrals", two tabs: "Referral program", "My Referrals"; 4-step journey (Link→Referred→Earned→Credited) | Page blank / error toast | Refresh — page still loads | Screenshot of full page | ☐ |
| CA-02 | Stage 1 → **Copy** (code) | — | Copy referral code | Button shows "Copied"; a screen reader announces "Referral code copied" | Nothing copied / no feedback | Paste into Notepad = your code | — | ☐ |
| CA-03 | Stage 1 → **Copy referral link** | — | Copy full link | Button shows "Link copied"; clipboard = `https://www.bispun.com/?ref=<YOURCODE>` | Wrong/empty URL | Paste link; open in a new browser | — | ☐ |
| CA-04 | Stage 1 → **Share on WhatsApp** | — | Share | Opens WhatsApp in a **new tab** with the link prefilled | Opens same tab / no link | — | Screenshot | ☐ |
| CA-05 | Refresh the page | — | Link persistence | Same code/link appears (no new code generated) | Code changes on refresh | Code identical to CA-02 | — | ☐ |
| CA-06 | Click each of the 4 stepper buttons | — | Navigation | Page scrolls to and focuses that stage section | No scroll / no focus move | — | — | ☐ |
| CA-07 | Read **Stage 2 Referred** with no referrals | — | Empty state | "No referrals yet. Share your link to get started." | Crash / blank | — | Screenshot | ☐ |
| CA-08 | Read **Stage 3 Earned** | — | Earnings | Shows Total earned, Successful referrals, Current rate + reward slabs (₹2,500 / ₹3,000 / ₹4,000), current slab highlighted | Wrong amounts | Matches §A rates | Screenshot | ☐ |
| CA-09 | Read **Stage 4 Credited** | — | Credit status | "Credited to you" and "Awaiting credit" cards; if awaiting > 0, text "Expected in about 5–8 days…" | No 5–8 day note when pending>0 | — | Screenshot | ☐ |
| CA-10 | Look for any "Redeem" / "Request Payout" button | — | 11.6 read-only | **There is none.** Client cannot request/mark credit | A redeem/payout button exists | — | Screenshot showing none | ☐ |
| CA-11 | Switch to **My Referrals** tab | — | 11.9 lead feature preserved | The old lead-tagging feature still works (tag leads, pipeline, QR) | Tab missing / broken | — | Screenshot | ☐ |

## B. Manager & Employee (same company)

| ID | Account | Action | Expected | Failure | Pass? |
|---|---|---|---|---|---|
| MG-01 | Manager | Open Referrals | Sees their own link, referred, earned, credit status per existing visibility rules; **no** credit/redeem controls | Can mark credited / sees another tenant | ☐ |
| EM-01 | Employee | Open Referrals | Same read-only view per existing permissions | Can mark credited | ☐ |
| XT-01 | Manager/Employee | (dev/advanced) Call `POST /api/admin/referrals/credit` with their token | **401 Unauthorized** | 200 / credit applied | ☐ |

## C. Super Admin — Mark credited (Admin → Referrals)

| ID | Navigate / Click | Example data | Why | Expected result | Failure looks like | Verify saved state | Evidence | Pass? |
|---|---|---|---|---|---|---|---|---|
| SA-01 | Admin portal → **Referrals** | — | Entry | "CRM Referrals & Credits"; tiles (referrers, successful, total earned, credited, awaiting credit); Slab Structure; "Referrer Earnings" table | Page error | Refresh persists | Screenshot | ☐ |
| SA-02 | Find a referrer with **Awaiting credit > ₹0** | — | Target | Row shows Earned / Credited / Awaiting credit + **"Mark credited"** button | No button when awaiting>0 | — | — | ☐ |
| SA-03 | Click **Mark credited** | — | 11.7 deliberate action | A dialog opens: title "Mark referral credited", states referrer, amount, and "cannot be undone"; focus starts on **Cancel** | No dialog / immediate credit | — | Screenshot of dialog | ☐ |
| SA-04 | Press **Escape** (or click Cancel) | — | Cancel safety | Dialog closes, **nothing changes** | Credit applied on cancel | Awaiting-credit unchanged after refresh | — | ☐ |
| SA-05 | Open dialog again → **Mark … credited** (confirm) | — | Confirm | Dialog closes; "Credited to users" rises, "Awaiting credit" falls to ₹0; a credit-history row appears | Amounts wrong | **Refresh** — change persists | Screenshot before/after | ☐ |
| SA-06 | Immediately click **Mark credited** again on same row (if visible) | — | Double-credit guard | Button now says "Fully credited" (disabled); if forced via API → 409 "no amount awaiting credit" | Amount credited twice | Totals unchanged | — | ☐ |
| SA-07 | (If a legacy request exists) "Legacy Payout Requests" panel | — | 11.9 no conflict | Panel shows historical requests; paying one cannot push total credited above earned (409 if it would) | Over-credit allowed | — | — | ☐ |

## D. Notification (as the credited Client Admin)

| ID | Action | Expected | Failure | Verify | Pass? |
|---|---|---|---|---|---|
| NT-01 | After SA-05, log in as the credited referrer; open the bell/notifications | An **"Amount credited"** notification: "Your referral reward of ₹X has been marked as credited…" with the correct ₹ amount | Wrong amount / no notification / wrong user | — | ☐ |
| NT-02 | Click the notification | Navigates to the Referrals page | Goes nowhere / wrong page | — | ☐ |
| NT-03 | Refresh; mark read | Notification persists; read/unread state correct | Reappears as unread / duplicates | Refresh | ☐ |
| NT-04 | Confirm only one notification was sent for that credit | Exactly one (no duplicates on retry) | Multiple identical notifications | — | ☐ |

## E. End-to-end referral (needs self-serve signup)

> **TC-E2E (BLOCKED without a disposable Dev DB + sandbox signup).** Requires creating a real referred company via the paid self-serve onboarding using a referral code. Flag to dev if the sandbox/payment-test path is not available.

1. Client Admin copies link (CA-03). 2. In a **new browser**, open `…/?ref=<CODE>` and complete self-serve signup + paid onboarding (test/sandbox). 3. Referred company appears under **Stage 2 Referred** for the Client Admin. 4. **Earned** increases per slab. 5. **Awaiting credit** shows with the 5–8 day note. 6. Super Admin credits (SA-05). 7. Client sees **Credited** rise + notification (NT-01). 8. Refresh both portals — everything persists.

**Self-referral check:** sign up using the Client Admin's own code **and their own email** → **no** referral/earning is created.

## F. Responsive & accessibility (desktop + mobile)

| ID | Action | Expected | Pass? |
|---|---|---|---|
| RS-01 | View Referrals at widths 375 / 390 / 768 / 1024 / 1440 px | No horizontal scroll; stepper wraps; cards stack; tables scroll within their container | ☐ |
| RS-02 | Keyboard only: Tab through link/copy/share/stepper/tabs | Every control reachable, visible focus ring | ☐ |
| RS-03 | Open "Mark credited" dialog with keyboard | Focus trapped in dialog; Escape closes; focus returns to a sensible control | ☐ |
| RS-04 | Android app (Capacitor) → Referrals | Same screens render and work; navigation responsive | ☐ |

---

### Legend
Pass = matches "Expected". Fail = matches "Failure looks like" — note the ID and attach a screenshot.
"Verify saved state" = refresh the page (or re-login) and confirm the change is still there (proves it is database-backed, not just on-screen).
