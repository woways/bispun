# Users & Roles — Team Templates (live portal)

Date: 2026-11-24
Status: Proposed — awaiting approval

## Intent / why
The Claude artifact (`claude.ai/artifact/8W2NUJtWp1tXNWogPfDsPt`) prototypes a
one-click way to set up a team: pick a ready-made **template** and it creates the
org's **levels** and their permissions, so an admin isn't hand-building the access
matrix from scratch. We are bringing that one new capability into the real portal's
**Settings → Users & Roles** screen.

## Goals
- Add a **Templates** sub-tab to Users & Roles with the three templates from the
  artifact: *Boss + Telecallers*, *Domestic Team*, *Domestic + International*.
- Each card lists the levels it will set up (name · scope · permission %) and has
  **Apply** (and a lightweight **Preview** that jumps to the Access tab).
- **Apply** creates/updates real levels with correct permissions via the existing
  level APIs, translated into the real `accessModel` shape.
- Ship it working, then manually verify: apply each template and create a user at
  each resulting level against the **Dev** DB.

## Scope addendum (2026-11-24, user-directed) — visual parity with the artifact
After the Templates feature shipped, the user asked to match the artifact's look
exactly. Added to scope:
- **Access editor → full matrix rebuild** (user chose this): modules × the 11
  actions in one grid, core/extended split, expandable object sub-rows, amber
  "partial" module cells, NA cells, level pills, scope radios, legend, save/reset
  bar — mapped onto the real `ACCESS_GROUPS` (pages = module rows, comps = object
  rows). The admissions stream/college scoping is **kept** as a section below the
  matrix (no regression) even though the artifact omits it.
- **Toggle style** matches the artifact (pill + check-on + amber-partial) but the
  ON color **follows Branding** (themeable `brand-*`), per user choice — not the
  artifact's fixed #2563eb.
- **Departments** → artifact tile grid (icon, code, description, member count).
- **Levels** → artifact row style (rank badge, scope, permission meter, Add user /
  Edit access actions).
- **Templates** → the per-role dot/circle is removed entirely.

## Non-goals
- Market (Domestic/International) is shown as a label only; it is **not** wired to a
  data field — the real admissions stream/college scoping is separate and untouched.

## Anti-goals (would make this a failure)
- Deleting or orphaning existing levels or the users assigned to them.
- Writing anything to the Pond (Prod) DB during testing.
- Duplicating the protected Admin level.

## Constraints
- Levels persist via `/api/client/users/levels` (POST create, PATCH `:id`, PATCH
  `:id/access`), returned list replaces `organization.levels`.
- Level permissions use `accessModel.js`: `{ scope, components{compId:{Action:true}}, admissions }`,
  rolled up to `canManage*` flags by `flagsFromComponents`.
- UI-file edits are gated by the project's accessibility hook → accessibility-lead
  review before editing `.jsx`.
- Only a Client Admin can create levels/users.

## Approaches considered (Apply behavior — decided with user)
- **Full replace** (artifact's literal wording): delete all non-Admin levels, recreate.
  Rejected — breaks users currently on removed levels.
- **Replace only if empty**: refuse on a non-fresh org. Rejected — too limiting; blocks
  the common case of an org that already added a user or two.
- **Safe merge (CHOSEN)**: for each template role, match an existing level by name
  (case-insensitive); if found, update its permissions (PATCH access); if not, create it
  (POST). Never delete. Protected Admin is matched, never duplicated or modified. No data loss.

## Design (the how, as decided)
1. **`accessModel.js` additions (shared, unit-testable):**
   - `TEAM_TEMPLATES`: ported from the artifact (key, name, tagline, description, roles[]).
     Each role: `{ name, scope, market?, admin?, access }` where `access` is the coarse
     per-module map (`"Dashboard":"view"`, …).
   - `MODULE_TO_PAGE_IDS`: maps each artifact module name → real `ACCESS_GROUPS` page id(s)
     (e.g. `"Admissions"` → the 4 admissions pages; `"Finance"` → `revenue`; etc.).
   - `ACCESS_LEVEL_ACTIONS`: `full` = all of a component's acts; `manage` = all but `Delete`;
     `edit` = View/Create/Edit/Comment; `view` = View/Export; `own` = View/Create/Comment/Message
     — each intersected with the component's declared `acts`.
   - `levelPermissionsFromTemplateRole(role)` → `normalizeLevelPermissions`-shaped object
     (`scope` from a `SCOPE_LABEL→key` map; `components` expanded via the two tables above;
     `admissions` empty). Admin role → full access is handled by the existing Admin level,
     so templates never emit an Admin permissions object.
2. **`Settings.jsx`:**
   - Add `"templates"` to the Users & Roles sub-tab list (placed first; default tab
     unchanged — my call).
   - `vTemplates`-style section rendering the three cards (brand theme, our typography,
     right-side-drawer conventions where a modal is needed).
   - `applyTeamTemplate(templateKey)`:
     - Confirm dialog summarizing what will be created vs. updated (safe merge; nothing deleted).
     - For each non-admin role: find level by name → PATCH `:id/access` with translated
       permissions, else POST create `{name, code(auto), rank(after admin), active:true,
       permissions}`.
     - Auto-`code` from name initials (deduped).
     - Refresh `organization` + `loadUsers`; success toast with counts; errors surfaced in
       the existing `usersError` channel.
3. **Tests:** unit tests for `levelPermissionsFromTemplateRole` (each template role →
   expected flags/components, no Admin emission, scope mapping, action intersection).
4. **Manual QA (Dev only):** start dev server (5175/4001), log in as Client Admin on the
   **ep-blue-mouse (Dev)** DB, apply each template, confirm levels + permissions, create a
   user at each level, confirm assignment. Report results. (Needs an admin login — will ask.)

## Left to the builder
- Exact `code` derivation/dedup and rank ordering details.
- Card copy/preview affordance polish within the brand system.
- Whether Preview deep-links to Access with the level preselected or just opens Access.

## Attribution
Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>
