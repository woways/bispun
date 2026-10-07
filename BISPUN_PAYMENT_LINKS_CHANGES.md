# Super-admin payment links + PDF invoice — change set

Approach A: reuses your existing order → verify → webhook → receipt pipeline.
**No database migration. No new backend dependency except `jspdf` (frontend).**

## Files in this change set

### New files (drop in as-is)
- `server/routes/adminPaymentLinks.js` — `POST /api/admin/payment-links` (Super Admin). Creates a Razorpay order + a `CREATED` PaymentTransaction, returns a signed `/pay/<token>` URL.
- `server/routes/publicPay.js` — public `GET /api/public/pay/:token` (info) and `POST /api/public/pay/:token/verify` (verify + activate). No login required.
- `src/PayPage.jsx` — the public pay page (opens Razorpay Checkout, shows receipt + Download PDF).
- `src/lib/invoicePdf.js` — `downloadInvoicePdf(receipt)` — client-side GST invoice PDF.
- `src/modules/admin/GeneratePaymentLinkButton.jsx` — drop-in Super Admin button.

### Modified files
- `server/index.js` — mounts the two new routers (2 imports + 2 `app.use`).
- `src/App.jsx` — adds public route `/pay/:token`.
- `package.json` — adds `"jspdf": "^2.5.1"`.

## Two one-line insertions you add

1) **Super admin "Generate payment link" button** — in `src/modules/admin/Clients.jsx`, wherever you show a client's actions (list row or detail panel), add:
```jsx
import GeneratePaymentLinkButton from "./GeneratePaymentLinkButton";
// ...
<GeneratePaymentLinkButton companyId={client.id} />
```

2) **"Download PDF" on the existing client-portal receipt** — in `src/ClientPortal.jsx`, near the existing print button:
```jsx
import { downloadInvoicePdf } from "./lib/invoicePdf";
// ...
<button onClick={() => downloadInvoicePdf(receiptData)}>Download PDF invoice</button>
```
(`receiptData` is the receipt object the portal already loads.)

## Deploy steps
1. `npm install`  (pulls in jspdf)
2. Commit & push to `main` → Render (API) and Vercel (web) auto-deploy.
3. Optional env on Render: `PUBLIC_WEB_URL=https://bispun.com`
   (If unset, it uses the first https origin in `CLIENT_URL`, which is already bispun.com.)

## How it works
- Admin clicks **Generate payment link** → gets `https://bispun.com/pay/<token>` → sends it to the client.
- Client opens it → sees the fixed plan amount (incl. discount + 18% GST) → pays by UPI/card/netbanking.
- On success: subscription activates, receipt shows, **Download PDF invoice** available.
- The **webhook** (`payment.captured`) also finalises independently — so even if the client closes the tab, the payment still activates and shows in Super Admin → Payments.

## Test (test mode)
- Generate a link for a test client, open it, pay with card `4111 1111 1111 1111`, any future expiry, CVV `123`.
- Confirm: success screen → PDF downloads → client appears paid in Super Admin.

## Notes / limits
- Link validity: 7 days (change `expiresIn` in `adminPaymentLinks.js`).
- Amount is locked server-side; the payer cannot change it.
- Self-serve onboarding reuses the exact same `/api/public/pay` engine when you build it next.
