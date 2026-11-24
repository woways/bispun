# Super Admin Coupons & Referral Payout — Final Report

**Date:** 2026-11-18 · **Base main:** `d6bad84` (fetched; PR #20/#44/#45 confirmed merged) · **Work branch:** `verify/superadmin-coupons-referrals` (commit `896875d`, local in `S:\Bispun-meetfix`).

## 1–5. Verification & test results

| # | Item | Result |
|---|---|---|
| 1 | Existing coupon list verified | **YES** — table with code, GST-inclusive amount, status, used/remaining, validity, eligible plans. |
| 2 | Create Coupon button working | **PASS (code-level)** / NOT TESTED live — "New coupon" button opens an accessible create dialog; POST `/api/admin/coupons`. |
| 3 | Coupon editing & activation | **PASS (code-level)** — Pencil → edit (PATCH); `role="switch"` toggle activate/deactivate; C6 rejects validFrom > validUntil; C4 shows IST dates. Live NOT TESTED. |
| 4 | Coupon signup/payment tests | **Unit PASS** (140/140, incl. C1/C3 concurrency, C2 sweeper, GST split). Real Razorpay test-mode capture/consume/release/concurrency/webhooks **NOT TESTED** (needs live keys + accounts). |
| 5 | Referral payout & Mark Credited | **PASS (code-level)** — idempotent credit (advisory lock + recompute in-tx), `requireSuperAdmin`, caps to pending, excludes legacy reserved amounts, once-only notification (`notifiedAt`). Live NOT TESTED. |

## 6. Actual bugs/gaps found & fixed (confirmed, not speculative)
- **Payout reference not captured on "Mark credited".** The DB (`ReferralPayoutRequest.paymentReference/source`) and the `/credit` endpoint already supported it, but the dialog never collected it, so every admin credit stored `paymentReference: null` and the history couldn't show how an entry was created.
  **Fixed:** added optional **Payment / UTR reference** + **Note** fields to the Mark-credited dialog (sent to the existing endpoint); added a text **Source** column ("Admin credit" / "Client request") and relabelled the section **"Payout & credit history"**; the GET now returns `source`. Accessibility-lead reviewed the plan and it was implemented to that checklist (labelled inputs, single autoFocus on the first input with `aria-describedby` so the "cannot be undone" warning is still announced, ≥3:1 input borders + focus ring, state reset on close, source as text not colour).
- **No other confirmed bugs.** Both Super Admin modules were already complete and strongly accessible; I did not invent changes.

## 7. Files & commits
Commit `896875d` on `verify/superadmin-coupons-referrals`:
- `src/modules/admin/Referrals.jsx` (dialog fields + Source column + relabels)
- `server/routes/adminReferrals.js` (GET returns `source`)
No schema change.

## 8. GitHub main status — ⚠️ NOT YET INTEGRATED (blocked)
The change is committed locally and verified, but **the push to GitHub failed**: mid-session, git's HTTPS remote access broke — `git fetch`/`git push`/`git ls-remote` all now return *"Could not read from remote repository"* (fetch worked at the start of this turn). The `gh` CLI/API still works (auth healthy, `repo` scope), but `git push` even with gh's credential helper fails, and `gh auth setup-git` (the standard fix) was blocked by the session's permission classifier. So **PR + merge could not be completed this turn.** The commit is safe in `S:\Bispun-meetfix`.

**To finish (run these yourself, or re-authorize git):**
```
cd S:\Bispun-meetfix
gh auth setup-git
git push -u origin verify/superadmin-coupons-referrals
gh pr create --repo woways/bispun --base main --head verify/superadmin-coupons-referrals --title "Super Admin: capture & show payout reference on Mark Credited"
```
Then merge once CI is green (same as PRs #44/#45). I can drive this automatically again as soon as git remote auth is restored.

## 9. Production deployment status
Unchanged from the prior gate: Render build command is now `npm install && npx prisma generate` (no `db push`). This change adds **no schema**. Frontend auto-deploys via Vercel on merge; the backend `source` field populates after the Render backend redeploys. Interim safety: before the backend redeploys, the pinned backend ignores the extra body fields and the Source column falls back to "Client request" — graceful, not broken. `0008a`/`0008b` referral-lifecycle migrations remain a separate, pre-existing deployment item (not introduced here).

## 10. Remaining issues
- **Integration blocker:** git remote push auth (above) — needs re-auth or permission to run `gh auth setup-git`.
- **Live/E2E not tested:** Super Admin browser flows, real Razorpay test-mode payment lifecycle, multi-account referral crediting — all need live credentials.
- My Store: untouched.

---

# Simple guide (Romanized Telugu) — exact menu paths

> Portal paths: **Super Admin** = login at `bispun.com/admin` → left menu. **CRM Admin / staff** = login at `bispun.com/login` → left menu. **Customer** = `bispun.com/signup`.

### 1. Super Admin existing coupons ela chudali
- `bispun.com/admin` lo login avvandi → eduru-left menu lo **Coupons** (🎟️) click cheyyandi.
- Akkada unna table lo anni coupons untayi: **Code, Amount (incl. GST), Status, Used/Remaining, Valid dates, Eligible plans**. Paina unna **search box** lo code type chesi vethakavachu.

### 2. Kotha coupon ela create cheyyali
- **Coupons** page lo kudi-paina **"New coupon"** (+) button click cheyyandi.
- Form lo: **Code** (4–40 letters/digits), **Amount (GST-inclusive)** — ఇది customer kattē final total (GST daanilo already untundi, paina add avvadu), **Description** (optional), **Valid from / Valid until**, **Max redemptions**, **Per-customer limit**, **Eligible plans** (tick cheyyandi), mariyu **Active** toggle.
- **"Create coupon"** click cheyyandi → list lo kottha coupon kanipistundi.

### 3. Coupon edit / activate / deactivate
- Coupon row lo kudivaipu **pencil (✏️)** icon → edit; marchi **"Save changes"**.
- Row lo unna **toggle switch** tho **Active/Inactive** cheyyandi. Inactive ante signup lo aa code pani cheyadu.
- Note: Valid-from, Valid-until kante mundu undali; lekapothe system reject chestundi.

### 4. Coupon redemption history ela chudali
- Coupon row lo **history (🕘)** icon click cheyyandi → aa coupon ki **Status, Amount, Customer, Plan, When** tho redemptions list kanipistundi.

### 5. Super Admin referral rewards review
- Left menu lo **Referrals** (CRM Referrals & Credits) click cheyyandi.
- Paina 5 cards: **Active referrers, Successful purchases, Total earned, Credited to users, Awaiting credit**. Kinda **Slab Structure** mariyu **Referrer Earnings** table: okko referrer ki **Successful, Slab, Rate, Earned, Credited, Awaiting credit**.

### 6. "Mark credited" eppudu, ela vadali
- **Mukhyam:** Mark credited ante — *meeru nijam ga bank/UPI lo payment chesaka* aa amount ni CRM lo "credited" ga record cheyyadam. System automatic ga bank transfer cheyadu.
- Referrer row lo **"Mark credited"** click → dialog lo amount choopistundi. **Payment / UTR reference** (optional) mariyu **Note** (optional) nింపండి (nijam payment reference ivvadam manchidi), tarvata **"Mark … credited"** confirm cheyyandi.
- Idi **okkasare** credit chestundi (double-click chesina malli credit avvadu), referrer ki **"Amount credited"** notification pamputundi, mariyu history lo **Source = "Admin credit"** ga kanipistundi. **Undo ledu** — confirm cheyyadaniki mundu payment verify cheyyandi.

### 7. Normal CRM Admin referrals ela share chesi earnings chudali
- `bispun.com/login` → login → left menu lo **My Referrals** (🎁).
- Akkada mee **referral link & code**, **Copy link**, **WhatsApp share**, **QR code** untayi — vాటితో share cheyyandi. **Referred businesses**, **Earned/Pending rewards**, **Credit status** kూడా kanipistundi.
- **"My Referrals" lead-tracking tab** — idi mee leads ni track cheyyadaniki matrame; **daanivalla డబ్బు reward raadu** (cash reward CRM subscription referrals valla matrame).

### 8. Customer coupon ni signup lo ela వాడాలి
- `bispun.com/signup` → plan select chesi, admin details steps complete cheyyandi.
- Coupon step lo **coupon code** type chesi **Apply** cheyyandi → correct **final payable amount** (GST-inclusive) kanipistundi. Code invalid/expired/inactive అయితే reject avtundi. Tarvata Razorpay tho pay cheyyandi.
