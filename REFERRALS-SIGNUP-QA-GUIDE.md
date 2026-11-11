# Referral Signup Lifecycle — Dev Manual QA Guide

Branch `feat/referral-signup-lifecycle`. **Dev environment + Dev database only.** Do not use production, real money, or real customer accounts.

Lifecycle under test: **Referral link → Referred (verified signup/order started) → Earned (payment captured) → Credited (Super Admin)**.

---

## 0. Prerequisites (flag any as BLOCKED if missing)

| # | Prerequisite | Needed for |
|---|---|---|
| 0.1 | Migration **0008** applied to **Dev** DB (`bispun-mobile-dev`), backend restarted | all tests (schema columns) |
| 0.2 | Dev backend on `.env.development` (`:4000`) + frontend (`:5173`) running | all |
| 0.3 | A **Client Admin** referrer account + a **Super Admin** account | SC-06/07/08 |
| 0.4 | **MSG91 test** `MSG91_AUTH_KEY` + `MSG91_OTP_TEMPLATE_ID` on the Dev server | phone OTP (SC-03). Without it, phone OTP returns a clear 503 "Phone OTP is not configured…" → mark SC-03+ **BLOCKED** |
| 0.5 | **SMTP** test mail on Dev | email OTP (SC-03) |
| 0.6 | **Razorpay TEST** key id/secret on Dev + a Razorpay test card | SC-05 payment |

> If 0.4 or 0.6 are unavailable, complete SC-01/02/04 and mark SC-05+ **BLOCKED** with the exact missing config. Do not fake a PASS.

---

## Test cases

| ID | Purpose | Steps | Expected | Result |
|---|---|---|---|---|
| **SC-01** | Configurable link (not prod) | As Client Admin → **Referrals** → copy the referral link | Link is `http://localhost:5173/signup?ref=<CODE>` (Dev), **not** `www.bispun.com`. WhatsApp/QR/email use the same URL. | ☐ |
| **SC-02** | Auto-capture `?ref` (no typing) | Copy the link; open it in a **new Incognito** window | `/signup` loads; the **Referral Code field is pre-filled** with `<CODE>`; a screen reader announces "Referral code applied". You did not type it. | ☐ |
| **SC-02b** | Code survives navigation | From the prefilled signup, change plan / move through steps | Referral code remains filled through plan selection + OTP steps. | ☐ |
| **SC-03** | Verifications | Enter a **dummy** company/admin using throwaway emails + a test phone; complete **email + phone OTP** (Dev test config) | OTPs verify. (If MSG91 unset → clear error, mark BLOCKED.) | ☐ |
| **SC-04** | Referred (no payment) | Proceed to the payment step so the order starts, then **stop — do not pay**. Log back in as the **referrer** → Referrals → Referred | The dummy business appears under **Referred** with an amber **"Referred"** badge. It is **NOT** in Earned; Earned amount unchanged. | ☐ |
| **SC-05** | Earned (payment) | Resume the dummy signup and complete the **Razorpay test** payment | The same row flips to **"Earned"** (emerald); Earned total increases by the correct slab amount (₹2,500/₹3,000/₹4,000 by count). No duplicate row. | ☐ |
| **SC-06** | Super Admin credit | Super Admin → Referrals → the referrer → **Mark credited** → confirm | Credited rises; Awaiting-credit falls; one credit-history row. Double-click → second attempt rejected. | ☐ |
| **SC-07** | Credited notification | Log in as the referrer; open notifications | **"Amount credited"** notification with correct ₹ amount; persists after refresh; no duplicates. | ☐ |
| **SC-08** | Client is read-only | As referrer/manager/employee, inspect Referrals | **No** Mark-as-Credited / Payout / Redeem control anywhere. | ☐ |
| **SC-09** | Invalid code | Open `/signup?ref=ZZZZINVALID` and complete a dummy **paid** signup | Signup succeeds; **no** referral row / reward created for any referrer. | ☐ |
| **SC-10** | Self-referral | Sign up a new company using the referrer's **own code and own email** | No referral row/reward created (self-referral blocked). | ☐ |
| **SC-11** | No duplicates | Refresh the signup page repeatedly; click the link several times; (if webhook fires) let payment finalize twice | Exactly **one** referral row per signup; one reward; no double credit. | ☐ |
| **SC-12** | Abandoned signup | Start a referred signup, never pay, wait | Stays **Referred** forever; never auto-becomes Earned or Credited. | ☐ |
| **SC-M** | Mobile 375px | View Referrals + `/signup` at 375px | No horizontal scroll; cards/stepper stack; Tag modal fits; referral field + prefill visible. | ☐ |

**Grading:** PASS = matches Expected · FAIL = deviates (attach repro) · BLOCKED = missing MSG91/Razorpay/SMTP/0008 · NOT TESTED.

---

## Notes
- **Earned qualifying event = Razorpay payment captured** at `finalizeSelfServeSignup` (approved business rule).
- Existing paid referrals were backfilled `SUCCESSFUL → EARNED` by migration 0008 (same counts, no duplicate rewards).
- Phone OTP stays **mandatory** — there is no OTP bypass. Secrets (MSG91/Razorpay) are set in Dev env only; never commit or print them.
