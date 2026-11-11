# Bispun — `prisma db push` Impact Audit for this release (2026-11-11)

Evidence-based audit of what Render's `prisma db push` would do to Production on an RC→main merge.
**Read-only** (`prisma migrate diff`, schema-to-schema; no DB touched, nothing executed).
Pairs with `BISPUN-RENDER-DBPUSH-P0-20261111.md` (the deployment-mechanism P0).

## Method
`npx prisma migrate diff --from-schema <main schema.prisma> --to-schema <RC schema.prisma> --script`
(main `f6b7dd5` vs RC `76d5ee0`). Because Render runs `db push` on every `main` deploy, Production
tracks **main's** `schema.prisma`; so this main→RC delta is what the next `db push` would apply —
**provided Production equals main's schema** (see residual risk).

## Result — the ENTIRE RC-over-main schema delta
```sql
CREATE TABLE "AccountDeletionRequest" ( id, email, reason, source DEFAULT 'public',
  status DEFAULT 'PENDING', companyId, userId, verificationToken, verifiedAt,
  handledByUserId, handledAt, adminRemarks, ipAddress, userAgent,
  createdAt DEFAULT CURRENT_TIMESTAMP, updatedAt, PRIMARY KEY(id) );
CREATE INDEX "AccountDeletionRequest_status_createdAt_idx" ...;
CREATE INDEX "AccountDeletionRequest_email_idx" ...;
CREATE INDEX "AccountDeletionRequest_companyId_idx" ...;
```
**26 SQL lines. 1 CreateTable + 3 CreateIndex. ZERO `ALTER`, ZERO `DROP`.** Fully additive.

| Expected change | Actual difference | Safe/Unsafe | Required action |
|---|---|---|---|
| New table `AccountDeletionRequest` + 3 indexes | CreateTable + CreateIndex | **SAFE** (additive; no data loss) | none — `db push` creates it |
| Column adds/drops | none | SAFE | none |
| Nullability / default changes | none in main→RC | SAFE | none |
| Unique/index/FK changes | none (only the 3 new indexes) | SAFE | none |
| Enum changes | none | SAFE | none |
| Dropped objects / data-loss warnings | **none** | SAFE | none |

So **this** release's `db push` would only create the account-deletion table — which is also the
object needed for the public deletion URL to persist in Production. For this specific delta, the
absence of `--accept-data-loss` is irrelevant (no destructive op is attempted).

## Prisma drift: `Lead.leadNumber` (Phase 5) — benign, no change needed
- Schema: `leadNumber Int?` (nullable) + `@@unique([companyId, leadNumber])`. Prod: reportedly
  `NOT NULL` (from `0005`), with trigger `assign_company_lead_number` + function.
- **App code never writes `leadNumber` on create** (verified: `server/routes/clientLeadStore.js`
  only *reads* it — search `LD####`, display `lead.leadNumber || null`). Creation relies on the
  **BEFORE INSERT trigger** to assign it. Therefore `Int?` is the **correct, intentional** contract:
  Prisma omits the field on insert and the trigger fills it; prod's `NOT NULL` is still satisfied.
- This drift is **not introduced by the RC** (both main and RC schemas say `Int?`), so it does **not**
  appear in the main→RC delta above. It is a pre-existing prod-vs-schema difference.
- **Do NOT** change the model to `Int` (would make Prisma require the field and break trigger-based
  assignment). **Do NOT** change prod's constraint. On a future managed migration, record the trigger
  as a Prisma-unmanaged object. A `db push` run against prod *might* attempt `ALTER COLUMN leadNumber
  DROP NOT NULL` (to match `Int?`) — that is **non-destructive** (constraint relaxation; trigger still
  fills values), so even then: no data loss.

## Residual risk (why this is not an unconditional GREEN)
The delta above assumes **Production == main's `schema.prisma`**. The `leadNumber` NOT NULL
observation proves prod differs from main-schema in at least one (benign) way, so the diff cannot
be guaranteed identical to a real **prod→RC** diff. To be certain, ONE of:
1. Operator runs `prisma migrate diff --from-url "$READONLY_PROD_URL" --to-schema <RC schema> --script`
   using a **genuinely read-only** Neon role (NOT the pond app credential) — the authoritative check; or
2. Operator runs the per-object read-only SQL (columns/enum/index/trigger) from
   `BISPUN-OPERATOR-PROD-EVIDENCE-CHECKLIST.md` and confirms prod matches main-schema (plus
   `AccountDeletionRequest` absent, `locked` present).
Either confirms no hidden prod drift would turn the next `db push` into something beyond the
additive table above.

## Keep the existing Build Command, or change it? (Phase 4 policy)
- **For THIS release**, retaining `npm install && npx prisma generate && npx prisma db push` is
  **LOW RISK**: the only auto-change is creating `AccountDeletionRequest` (additive, desired),
  **once residual-risk item (1) or (2) confirms no other prod drift.**
- **Systemically it remains risky** (any *future* schema edit auto-syncs prod unreviewed; a future
  destructive diff would fail the backend build → partial deploy). Minimum-risk long-term:
  `npm install && npx prisma generate` + a reviewed migration step. This is an operator dashboard
  change requiring separate approval — **not made here.**
- Net: this is a per-release clearance, not a blanket statement that `db push` is safe.

## Updated GO / NO-GO — 🟡 CONDITIONAL GO (pending 2 operator confirmations)
Flips to **GO** when:
1. **Prod schema confirmed == main-schema** via residual-risk (1) or (2) — i.e., the only db push
   effect is the additive `AccountDeletionRequest` table (and `locked`/`0003–0006` already present).
2. **Vercel** production branch + auto-deploy + rollback confirmed; **Neon backup/PITR window** confirmed.
3. Explicit authorization for the resulting Production deployment (the additive table creation).
Then: merge RC→main (which auto-deploys) is safe — db push creates the account-deletion table;
backend + frontend roll out; verify health. Still **NO** signed AAB (keystore creds).

If prod shows unexpected drift in (1), revert to **NO-GO** and apply only reviewed additive SQL.

## Evidence / tests this run
- `migrate diff` main→RC = 1 CreateTable + 3 CreateIndex, 0 ALTER/0 DROP (artifact computed read-only).
- `prisma validate` valid · `npm test` **86/86**.
- Git: main `f6b7dd5`, RC `76d5ee0` (0 behind / 46 ahead, clean superset), only PR #13 open.

## Preserved / untouched
No merge/push to main; no deploy; no dashboard change; no `db push`; no migration; no pond access;
no branch deletion; no Play submission. Features + branches + backups preserved.
