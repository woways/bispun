# Website handoff — add the "Startup" plan + make payment work

**Audience:** whoever builds/maintains the Bispun **marketing website** (a separate project from the
Bispun app/portal repo). Copy the "PROMPT" block below and give it to your website developer or
coding assistant. The rest of this file is the reference they'll need.

---

## TL;DR
- A new plan **Startup — ₹4,999/year, up to 2 users** now exists in the Bispun backend.
- The website should (1) **show** a Startup pricing card, and (2) its "Get started / Buy" button
  should **deep-link to the Bispun app signup** at `/signup/startup`, where the **existing Razorpay
  payment flow already runs** — the website does NOT need to build its own payment.
- **Precondition:** the backend changes must be LIVE IN PRODUCTION first (see "Before this works in
  production" at the bottom), or the plan won't appear and checkout won't find it.

---

## PROMPT (give this to the website dev / AI)

> We sell Bispun CRM subscription plans on our marketing website. A new entry-level plan has been
> added to the Bispun backend and must appear on the website's pricing section, and its purchase
> button must lead to a working payment.
>
> **New plan to add — "Startup":**
> - Name: **Startup**
> - Price: **₹4,999 / year** (plus 18% GST, shown GST-inclusive at checkout)
> - **Up to 2 users**
> - 5 GB storage
> - Features (same as the Basic plan, it's the cheaper 2-user entry tier):
>   - Up to 2 users
>   - Dashboard & core analytics
>   - UTM Leads & Lead Store
>   - Admissions management
>   - Revenue tracking
>   - In-app notifications
>   - Standard support
> - Show it as the **cheapest/first** card, before Basic (₹27,000), Pro (₹54,000), Advanced (₹81,000).
> - Plan key (used in the link): **`startup`**
>
> **Two ways to source the plans — prefer A:**
>
> **A. Dynamic (recommended):** Fetch the live plan list from the Bispun backend and render a card per
> plan, so prices/plans stay in sync automatically:
> `GET https://<BISPUN_APP_DOMAIN>/api/public/onboard/plans`
> Response: `{ success, plans: [{ key, name, tagline, yearlyPrice, offerPrice, offerEndsAt,
> storageLimitMb, maxUsers, breakdown: { subtotal, gstRate, ... } }] }`. It's public (no auth) and
> already returns `startup` with `maxUsers: 2`. Render `maxUsers` as "Up to N users" and
> `storageLimitMb` as storage. (If you keep hardcoded cards instead, just add the Startup card above.)
>
> **B. Static:** hardcode a Startup card with the details above.
>
> **Payment (make the button work) — do NOT rebuild payment:**
> Each plan card's primary button ("Get started" / "Buy" / "Choose Startup") must link to the Bispun
> app's hosted signup with the plan preselected:
> `https://<BISPUN_APP_DOMAIN>/signup/<planKey>`  → for Startup: `https://<BISPUN_APP_DOMAIN>/signup/startup`
> The app's signup page already runs the full, secure, GST-correct **Razorpay** checkout and creates
> the account on success. The website's only job is to send the buyer there with the right plan.
> Use a normal link/anchor (so it works without JS and opens the hosted, PCI-handled checkout).
> Do not collect card details or create Razorpay orders on the marketing site.
>
> Keep it accessible: real `<a href>` buttons with clear text (e.g. "Get started with Startup"),
> plan features as a list, and don't rely on color alone for the "most popular" / current markers.

---

## Reference: how payment actually works (so you can trust option A/B)

The Bispun **app** (not the website) owns the whole payment + provisioning flow, server-authoritative:

1. Buyer lands on `/signup/startup` (plan preselected & locked from the URL).
2. They fill org + admin details; the app calls `POST /api/public/onboard/start` → backend creates a
   **Razorpay order** (amount computed server-side: plan price + 18% GST, minus any coupon) and a
   PendingSignup.
3. Razorpay Checkout (`checkout.razorpay.com/v1/checkout.js`) opens for payment (UPI/cards/net-banking).
4. On success the app calls `POST /api/public/onboard/verify` → backend verifies the signature and
   finalizes: creates the Company, the Subscription on the chosen plan, clones the plan's modules, and
   creates the admin user.
5. Coupons (optional) go through `POST /api/public/onboard/coupon/quote` then `/start`.

Because the price is always computed on the backend from the Plan record, the website must **never**
send an amount — just the plan key via the deep link. This also means the Startup price/limits are
managed centrally (Super Admin → Plans), not on the website.

The public endpoints the website may call directly (all no-auth):
- `GET  /api/public/onboard/plans` — list active plans (now includes `startup`, with `maxUsers`).
- (The `start` / `verify` / `coupon/quote` endpoints are driven by the hosted signup; the website
  does not need to call them if it links to `/signup/<key>`.)

`<BISPUN_APP_DOMAIN>` = the same domain as your Bispun portal/login (the hosted app). Confirm the exact
value with your ops/deploy owner before wiring the links.

---

## Before this works IN PRODUCTION (precondition — tell your ops/deploy owner)

The Startup plan currently exists only in the **development** database. For the website + payment to
work for real customers, production must have:

1. The DB migration **`0015_add_plan_max_users_and_startup.sql`** applied to the production Neon
   database ("Pond") — it adds `Plan.maxUsers`, seeds the `startup` plan (₹4999 / 2 users / 5 GB), and
   gives it Basic's modules. (It also depends on `0014_add_storage_limits.sql` being applied, since the
   schema now has storage columns too.)
2. The updated **backend deployed** (the one that returns `maxUsers` from `/api/public/onboard/plans`
   and enforces the 2-user cap).

Until both are live in production, `GET /api/public/onboard/plans` won't return Startup on the live
site and `/signup/startup` won't find the plan. See `PROD-DEPLOY-RUNBOOK.md` in the app repo and the
migration-order notes for the gated, operator-run steps.

---

## What's already done in the Bispun app (for context)
- Startup plan is in the DB (dev), shown in Super Admin → Plans, the in-app signup, and the portal
  Bills & Subscription (with the feature list above).
- The 2-user cap is enforced: adding a 3rd user on a Startup company returns a 403 "upgrade" message.
- The in-app signup already deep-links by plan key (`/signup/:plan`) and runs Razorpay checkout.
