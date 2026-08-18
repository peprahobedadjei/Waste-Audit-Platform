# Firestore setup

Two files govern the database, and both need deploying once:

```bash
npx firebase login
npx firebase use waste-system-53fa3
npx firebase deploy --only firestore:rules,firestore:indexes
```

## Indexes — `firestore.indexes.json`

Firestore needs a **composite index** for every query that combines a `where`
filter with an `orderBy` on a different field. Without one the query throws
`FAILED_PRECONDITION` at runtime — it compiles fine, passes review, and only
fails when a real user opens the screen. That is how the auditor's Messages and
My Submissions screens first returned 500.

Equality-only queries are not listed here; Firestore serves those from the
single-field indexes it maintains automatically.

| Collection | Fields | Used by |
|---|---|---|
| `visits` | `auditorId`, `capturedAt ↓` | `/api/mobile/visits`, auditor detail |
| `visits` | `houseId`, `capturedAt ↓` | House detail visit history |
| `notifications` | `auditorId`, `createdAt ↓` | `/api/mobile/notifications` |
| `notifications` | `auditorId`, `readAt`, `createdAt ↓` | Unread filter |
| `alerts` | `userId`, `createdAt ↓` | Manager alert bell |
| `sessions` | `subjectId`, `loginAt ↓` | Auditor detail — last sign-in |
| `sessions` | `subjectId`, `logoutAt`, `loginAt ↓` | Presence heartbeat |

Indexes take a few minutes to build after deploying. Queries keep failing until
they finish, so give it time before retesting.

**If you add a new `where` + `orderBy` query, add the index here too.** The
server now returns a clear 503 rather than a bare 500 when one is missing, and
logs Firestore's own console link for creating it — check the runtime logs.

## Rules — `firestore.rules`

Deny-all. Nothing reaches Firestore directly: the dashboard and the Android app
both go through Next.js API routes, which use the Admin SDK, and the Admin SDK
bypasses rules entirely.

This is a backstop rather than an access model. The Firebase web API key is
public by design — it ships in the browser bundle — so without these rules
anyone who viewed source could query every collection straight from the client.

Two that matter most:

- **`visits` must never be client-writable.** A rebuilt Android app could
  otherwise set `flagged: false` on its own submissions, which is exactly the
  tampering the server-side distance check exists to prevent.
- **`auditLog` and `sessions` must never be writable**, or the record of who did
  what could be rewritten by whoever did it.
