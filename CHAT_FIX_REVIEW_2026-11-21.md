# Bispun CRM — Chats review (2026-11-21)

## Source
User-provided `bispun-project-source-2026-11-21.zip`. This review is of the source ZIP only; no production DB/logs, credentials, or running app were supplied.

## Applied changes
1. `server/index.js`: Accept up to 15 MiB JSON **only** at `/api/client/chat/upload`. The preexisting global 12 MiB limit rejects some otherwise valid 10 MiB binary uploads after base64 expansion (~13.3 MiB). Other endpoints keep 12 MiB.
2. `server/routes/clientChat.js`: Early reject client-declared files exceeding the 10 MiB maximum, while keeping the existing decoded-buffer limit and allow-list.
3. `src/modules/client/ChatPanel.jsx`: Upload failures now expose a Retry control (with underlying error available as tooltip/accessibility label). Reattempting clears stale error state. Group title/member-count in the chat header opens the existing member panel, showing member names/avatar/email, creator admin indicator, and permission-based Add/Remove/Leave options.

## Still needs verification — do NOT treat as a production fix
- The screenshot's full-section fallback does not identify its original exception; the named `10sar school` data and production logs were not accessible. Check browser Console and failed `/api/client/chat/:id/messages` request, server logs, schema history, and actual group membership. In particular, confirm the deployed DB includes `ChatAttachment`, `ChatMessageDeletion`, `ChatReaction`, and chat member fields from the Prisma schema; do NOT run `prisma db push` on production without backup/impact review.
- Attachment upload may additionally fail when the server's `S3_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, and signing secret (`FILE_SIGNING_SECRET`/`JWT_SECRET`) aren't configured. The application code explicitly throws `S3 file storage is not configured` in that case; no actual production configuration was inspected. Verify `PUBLIC_API_URL`, upload response status, signed file proxy retrieval, and reverse-proxy limits.
- The server currently trusts URLs/publicIds submitted through the socket for chat attachments; before production rollout, enforce that referenced object keys belong to the requesting company and that a message only attaches objects uploaded by an authorized sender. Security hardening remains outstanding.

## Checks performed
- `node --check server/index.js` and `node --check server/routes/clientChat.js` passed.
- React build and runtime integration tests **not run**: dependencies were not included in the ZIP, and no test DB was supplied.
- No deployment, production DB operations, secrets, or Git changes performed.

## Manual QA after installing/building in a safe environment
- Upload/send/open images, PDFs, Office files, CSV/text, test 1 KB, 9 MB, and 10 MB; confirm 10.1 MB rejection.
- Disconnect S3 temporarily in dev and confirm user-visible Retry behavior; restore config and retry.
- Open `10sar school` and older/newer groups; compare API errors, message rendering, membership, mentions, reactions, and attachments.
- In group header click name/member count; inspect exact members, admin/you markers, Add/Remove/Leave permissions, live refresh, mobile/desktop.
- Test individual chat, messaging and attachments on Web and Android; verify cross-company isolation and notification behavior.
