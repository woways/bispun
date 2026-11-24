# Bispun CRM — Referrals & Coupons — Simple Guide (Romanized Telugu)

> Idi Referrals mariyu Coupons ela pani chestayo simple Telugu (English letters) lo explanation.
> Chివర్లo **live-tested vs unit-tested** ani clear ga label chesanu.

---

## 1) REFERRALS — Super Admin

**Ekkada untundi:** Super Admin portal → **Referrals** (page title: *"CRM Referrals & Credits"*).

- **Referral purchases ela count avtayi:** Oka business, mee CRM admin yokka referral **link/code** tho signup chesi, **subscription payment complete** chesi account activate chesinapudu — adi **successful referral (EARNED)** ga count avutundi. Signup matrame ayyi (payment leకపోతే) adi **"Referred"** stage lo untundi, inka reward raadu.
- **Earnings & slabs:** Prathi successful referral ki oka **rate** untundi. Enni successful referrals unnayo batti **slab** maarutundi (ekkuva referrals → ekkuva rate). Ee slabs backend reward program lo set chesi untayi (code lo hardcode kaadu).
- **Pending amount ela calculate avutundi:** **Pending (Awaiting credit) = Total Earned − Already Credited.** Ante earn ayindi kaani inka pay cheyyani amount.
- **Mark Credited ela pani chestundi:** Super Admin payment **verify chesaka** "Mark Credited" click chestaru. Appudu aa amount credited ga maarutundi.
- **Payment manual aa automatic aa:** **MANUAL.** System automatic ga credit cheyyadu — Bispun team (Super Admin) verify chesi mark chestaru.
- **Credit history & notifications:** Mark Credited chesaka aa user ki **"Amount credited"** notification veltundi. Credit history lo date, amount, reference kanipistundi. **Duplicate-credit protection** undi — okate reward rendu saarlu credit avvadu (unit-tested).

---

## 2) REFERRALS — Normal CRM Admin (regular user)

**Ekkada untundi:** CRM → **Referrals** → **"Referral program"** tab.

- **Link/code ekkada untundi:** "Referral program" tab lo mee **referral code** mariyu **link** untayi.
- **Copy / Share (WhatsApp, QR):** Code/link pakkana **Copy** button; **"Share on WhatsApp"** button (WhatsApp lo direct message); mariyu **QR code** — phone camera tho scan chesi signup link open cheyyochu.
- **Vere business ela signup avutundi:** Mee link `/signup?ref=CODE` open chesthe, signup page lo **referral code automatic ga prefill** avutundi (vaallu maarchukovachu/teeyochu). Signup ayyaka vaallu **"Referred"** lo kanipistaru.
- **Eppudu earnings ki qualify avutundi:** Aa business **subscription payment complete** chesi account activate chesinapudu → **"Earned"** avutundi, appudu reward **meedi**.
- **Rewards / credit status ekkada chustaru:** "Referral program" tab lo — **Earned**, **Awaiting credit**, **Credited** — ee stages lo chustaru.
- **Subscription rewards vs "My Referrals" lead tracking — difference:**
  - **"Referral program"** = vere **business** ni Bispun ki refer chesi **earn** chese program (reward tho).
  - **"My Referrals"** = mee CRM lo **meeru tag chesina leads/students** ni **NEW → Admitted** stages lo track chese **separate tool**. Deeniki subscription reward tho **sambandham ledu** — idi kevalam lead tracking.

---

## 3) COUPONS — Super Admin

**Ekkada untundi:** Super Admin portal → **Coupons**.

- **Coupon create ela:** "Coupons" page lo kotha coupon create chestaru.
- **Code + final GST-inclusive amount:** Coupon **code** enter chesi, **final price (GST included)** amount set chestaru — ante coupon vaadaka customer **final ga** entha pay cheyyalo **aa amount**. (Idi discount-percentage model **kaadu**, **final-price** model.)
- **Plan eligibility:** Ye **plans** ki coupon vaadochho select chestaru (eligible plans matrame).
- **Validity dates:** **Start/End** dates set chestaru; display **IST** lo untundi.
- **Limits:** **Total max redemptions** (motham enni saarlu) mariyu **per-customer limit** (oka customer enni saarlu) set cheyyochu.
- **Activate / Deactivate:** Coupon ni **active/inactive** cheyyochu — inactive aithe apply avvadu.
- **Redemption history & audit:** Ye coupon enni saarlu vaadaaru, status (**Reserved / Consumed / Released**) — annee history lo chustaru.

---

## 4) COUPONS — Customer Signup Portal (business owner sign up chesేటప్పుడు)

- **Coupon code ekkada enter chestaru:** Signup lo **coupon code** field lo (plan/payment step lo) enter chestaru — idi **referral code kante veru** (referral code Step 2 lo, coupon veru field).
- **Apply ela pani chestundi:** Code type chesi **"Apply"** click chesthe, coupon **valid** aithe final amount update avutundi (invalid/expired aithe message chupistundi).
- **Final amount ela maarutundi:** Coupon apply ayyaka payment summary lo **final GST-inclusive amount** coupon price ki maarutundi.
- **Payment success aithe:** Coupon **"Consumed"** avutundi (aa redemption use ayyindi, limit lo lెక్క avutundi).
- **Payment fail aithe:** Reservation **"Released"** avutundi — coupon malli vaadabadutundi (limit waste avvadu).
- **Abandoned (apply chesi payment cheyyaka velladam):** **C2 background sweeper** konni nimishaala (TTL, default 60 min) tarvata aa reservation ni **automatic ga release** chestundi — valid customers block avvakunda. (Idi code lo unit-tested.)

---

## ✅ Live-tested vs Unit-tested (honest labels)

| Area | Status | Evidence |
|---|---|---|
| Referral reward slab calc, Earned/Pending/Credited, duplicate-credit protection, dual-status (SUCCESSFUL==EARNED), REFERRED excluded | **UNIT-TESTED** | `referralRewards.test.js`, `adminReferralsAuth.test.js` (part of 48/48 pass) |
| Referral link `/signup?ref=`, `?ref` parse/sanitize | **UNIT-TESTED** | `referralLink.test.js` |
| Coupon GST-inclusive final price, eligibility, max + per-customer limits, concurrency | **UNIT-TESTED** | `coupons.test.js` |
| C2 abandoned-reservation release (Reserved→Released), payment success→Consumed logic | **UNIT-TESTED** | `couponReservationSweeper.test.js` |
| Full browser flow: signup with `?ref` → **test-mode payment** → EARNED, Super Admin **Mark Credited** click, WhatsApp/QR share buttons, coupon Apply in live signup | **NOT live-tested here** | Needs running backend + Blue dev DB + seeded accounts + Razorpay **test** keys; no real customer payment was or should be used |

> Note: Idi explanation guide — real customer payments **eppudu** cheyyakండి. Live verification ki **test-mode** data/payments matrame vాడండి.
