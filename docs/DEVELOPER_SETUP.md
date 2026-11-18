# Bispun CRM — Developer Setup Guide (Development)

Goal: every developer runs the CRM locally against the **shared development database
(Neon `blue-mouse`)**, with their own frontend calling their own local backend, and
**production (`pond`) never touched**.

> No secret values appear in this guide — only variable **names**. Get the actual
> values from the secure channel described in "Credentials".

---

## 1. Prerequisites

| Item | Required value |
|---|---|
| Node.js | **22.x** (repo `engines`: `>=22 <23`). Verify: `node -v` → `v22.x` |
| npm | 10.x (ships with Node 22) |
| Git | any recent version |

If `node -v` is not 22.x, install Node 22 (nvm: `nvm install 22 && nvm use 22`).

## 2. Checkout

```bash
git clone https://github.com/woways/bispun.git
cd bispun
git checkout <approved-dev-branch>   # confirm the branch with the team lead
npm install
```

## 3. Environment files (the part that breaks for most people)

The repo **does not** contain working env files — `.gitignore` excludes `.env` and
`.env.*` (only `.env.example` is tracked). So a fresh clone has **no backend
config**, and the backend refuses to start without it. You must create two files:

### `.env` — read by the **backend** (`dotenv/config` loads only this file)

Create `.env` in the repo root containing at least these variable **names**:

```
# --- required: backend will not boot without these ---
DATABASE_URL          # Neon blue-mouse POOLED url (dev). NEVER the pond/prod url.
DIRECT_URL            # Neon blue-mouse DIRECT url (for prisma migrate/introspect)
JWT_SECRET            # session signing secret (dev value)
OTP_SIGNING_SECRET    # signs OTP challenge/verify tokens
NODE_ENV=development
PORT=4000
CLIENT_URL=http://localhost:5173
DISABLE_BACKGROUND_WORKERS=true
TRUST_PROXY=false

# --- optional in dev (leave blank unless you are testing that feature) ---
SMTP_USER= SMTP_PASS= SMTP_FROM= SMTP_HOST= SMTP_PORT=
MSG91_AUTH_KEY= MSG91_OTP_TEMPLATE_ID=     # phone OTP (not configured in dev)
RAZORPAY_KEY_ID= RAZORPAY_KEY_SECRET= RAZORPAY_WEBHOOK_SECRET=   # use TEST keys only
CLOUDINARY_CLOUD_NAME= CLOUDINARY_API_KEY= CLOUDINARY_API_SECRET=
GOOGLE_CLIENT_ID= GOOGLE_CLIENT_SECRET= GOOGLE_REDIRECT_URI=
IPINFO_TOKEN= IDEOGRAM_API_KEY=
# seed (only if you run prisma/seed.js):
SEED_SUPER_ADMIN_EMAIL= SEED_SUPER_ADMIN_PASSWORD=
SEED_STUDENT_MENTOR_ADMIN_EMAIL= SEED_STUDENT_MENTOR_ADMIN_PASSWORD=
```

### `.env.development` — read by the **frontend** (Vite, dev mode)

Vite loads `.env.development` **and** `.env`, with `.env.development` winning. The
one value that must be correct for a desktop browser:

```
VITE_API_URL=http://localhost:4000
```

> ⚠️ Do **not** use `http://10.0.2.2:4000` for web dev — that address only works
> from the Android emulator. `.env.example` ships that value for mobile work, so
> copying `.env.example` → `.env.development` will break web login.

### Referral signup link (optional)

Referral share links are built from `VITE_PUBLIC_SIGNUP_URL`. It is **optional** —
if unset, the app falls back to `window.location.origin + /signup`, which is
correct in both Dev and production. Set it only to override:

```
# Dev (optional — origin fallback already gives http://localhost:5173/signup)
VITE_PUBLIC_SIGNUP_URL=http://localhost:5173/signup
# Production
VITE_PUBLIC_SIGNUP_URL=https://bispun.com/signup
```

Links are generated as `<base>?ref=<referralCode>`; the code is captured from the
URL on `/signup`, stored for the signup session, and prefilled automatically.

## 4. Run

Two terminals:

```bash
npm run server
```

```bash
npm run dev
```

- Backend: http://localhost:4000 (health: http://localhost:4000/api/health)
- Frontend: http://localhost:5173

## 5. Development login

Use the shared dev accounts in `blue-mouse` (ask the lead for which account is
yours). Phone SMS OTP is **not** needed to log in — login is email + password only;
OTP is only used in the signup/onboarding flow.

## 6. Credentials (secure sharing)

- **Never** commit `.env` / `.env.development`, paste secrets in chat/Slack/email,
  or share them on a USB stick.
- Share the dev secret bundle through a **secrets manager / password vault** (1Password,
  Bitwarden, Doppler, or an encrypted file the lead distributes). Each developer
  pastes values into their own local `.env` files.
- Prefer **Razorpay TEST keys** and empty SMTP/MSG91 in dev so no real email/SMS/
  payment can fire from a laptop.
- Rotate any secret that has ever been shared insecurely.

---

## 7. Per-developer verification checklist

Run on each laptop. Mark **PASS only when that developer confirms it.**

| # | Check | How | Expect |
|---|---|---|---|
| 1 | Node version | `node -v` | `v22.x` |
| 2 | Branch/commit | `git rev-parse --abbrev-ref HEAD && git rev-parse --short HEAD` | approved branch |
| 3 | Backend boots | `npm run server` | "Bispun API running", no throw |
| 4 | Backend health | open `http://localhost:4000/api/health` | `{ database: "connected" }` |
| 5 | DB identity | backend log / health | connected to **blue-mouse** (not pond) |
| 6 | Frontend loads | open `http://localhost:5173` | login page renders |
| 7 | API base URL | DevTools → Network on login | request goes to `http://localhost:4000/...` |
| 8 | Login | submit dev creds | `POST /api/client/auth/login` → **200** |
| 9 | Session | after login | `GET /api/client/auth/me` → 200, dashboard loads |
| 10 | Refresh persists | reload page | still logged in |
| 11 | Logout/re-login | logout then login | both succeed |

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Login shows **network error / connection refused** (no HTTP status) | Backend not running / crashed on boot, **or** `VITE_API_URL` points somewhere unreachable (e.g. `10.0.2.2:4000`) | Start backend; set `VITE_API_URL=http://localhost:4000` in `.env.development`; check backend terminal for a boot error |
| Backend exits immediately with `JWT_SECRET is required` or `DATABASE_URL is required` | `.env` missing or incomplete | Create `.env` with all **required** names in §3 |
| **CORS** error in browser console | `CLIENT_URL` doesn't include your frontend origin | Set `CLIENT_URL=http://localhost:5173` in `.env` (cookies need an exact origin match) |
| Login **401** | wrong credentials, **or** backend connected to a DB without your dev account | Verify creds; confirm `DATABASE_URL` host is **blue-mouse** |
| Login **500** | `JWT_SECRET` missing/invalid, or DB unreachable | Fix `.env`; confirm DB connectivity via `/api/health` |
| OTP send **503** (`PHONE_OTP_NOT_CONFIGURED`) | MSG91 not set in dev | Expected — does not block login |

---

### Isolation guarantee
- Backend DB comes from **`.env` `DATABASE_URL`** → must be **blue-mouse**.
- Production **`pond`** lives only in Render's environment (and a local `.env.pond.bak`
  backup). Keep `pond` out of every developer's `.env`. Never run `prisma db push`
  or `prisma/seed.js` against pond.
