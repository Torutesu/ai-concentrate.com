# AI Concentrate: architecture (2026-10-03)

Current state first; dated history is in `docs/release-readiness.md` and
`design/HANDOFF.md`. Review that drove this revision:
`docs/reviews/2026-10-03-non-ui-design-review.md`.

## Shape

A modular monolith. One operation registry serves every client:

```
Web UI ─ REST adapters ─┐
/api/v1/operations ─────┤   Clerk session (people) | OAuth access token (agents)
/mcp (MCP clients) ─────┤        └─► Actor { userId, channel, clientId, scopes, requestId }
cli/concentrate.mjs ────┘
              ▼
lib/domain/operations.ts      zod input, scope, MCP annotations
lib/server/operations.ts      executeOperation: scope check → validate → handler → audit
lib/server/service.ts         membership/role, CAS, idempotency, locks, size budget
   ├ lib/server/repository.ts SQL only (libSQL on Vercel, D1 on Sites)
   └ lib/server/generation.ts server-side AI proposals
        └ lib/ai/*            context builder, router, provider adapters, tasks
```

Routes never call the service directly; REST handlers are thin adapters that
call `executeOperation` and keep the Web response shapes.

## Data and editing

- A workspace has owner/editor/viewer memberships. Every read and write checks
  membership through one query that also hides deleted workspaces;
  cross-workspace IDs return 404.
- A production is a bounded aggregate (brief + up to 100 items). Limits are
  UTF-8 bytes (`lib/domain/limits.ts`): 48 KB per item, 256 KB per production,
  300 KB per request. The domain enforces them on every write path, including
  applying AI proposals, so a stored production is always saveable again.
  Reads parse structure only, so tightening a limit never breaks old data.
- A save is one transaction: compare-and-swap on `revision`, immutable snapshot
  in `revisions`, a slim idempotency receipt `{productionId, revision}` in
  `commands`, incremental search-index update (only changed items), and stale
  marking of proposals whose target text changed. All statements are guarded by
  the CAS result.
- Proposals (`changes`) have a lifecycle: proposed → applied | rejected | stale.
  Applying is a three-way check: the target item's current SHA-256 must equal
  the proposal's `beforeHash`. Edits to other items or the brief do not
  invalidate it. Locked items are never changed.
- `item_patch` and `brief_patch` let agents change one item or a few brief
  fields without resending the aggregate. `item_patch` accepts find/replace
  edits that must each match exactly once.
- Sources are stored with a preview and split into ~1,200-character chunks.
  Lists return summaries; text is read in ranges (`context_get`) or searched
  (`context_search`). Sources can be excluded from AI or deleted.

## Search

`search_docs` holds one row per production title and item; `search_fts` and
`source_chunks_fts` are FTS5 trigram indexes kept in sync by triggers.
Queries of 3+ characters use the index; 1–2 character queries (common in
Japanese) fall back to substring matching within the workspace. Production
lists read denormalized summary columns and keyset cursors.

## AI

- `lib/ai/router.ts` runs a task on the tier's route with at most one fallback
  to another provider, only for failures before any output (connection,
  timeout, 429, 5xx, credentials) and within a 50 s deadline. Refused,
  truncated or invalid output is reported, never silently retried elsewhere.
- Providers: OpenAI Responses API (`lib/ai/openai.ts`) and Claude via the
  official SDK (`lib/ai/anthropic.ts`, structured output through
  `output_config.format`, server-side refusal fallback on models that support
  it). Routes come from env (`lib/ai/config.ts`); a workspace policy can
  restrict which providers receive its content.
- Prompts are split into `system` (fixed), `context` (workspace profile +
  sources, identical across instructions) and `task` (brief, current text,
  instruction last). OpenAI gets a `prompt_cache_key`; Claude gets cache
  breakpoints. Context retrieval uses the brief, not the instruction, and is
  bounded by `AI_CONTEXT_TOKENS` (default 6,000).
- Long items are revised with find/replace edits instead of a full rewrite;
  output limits scale with the item. Short X/step items use the fast tier.
- Sources are redacted (keys, tokens, emails, phone numbers) before sending.
  Generated figures and URLs absent from every input become `warnings` on the
  proposal.
- Every provider attempt is a row in `ai_runs` (tokens, cache hits, cost when
  `AI_PRICES` is set, latency, error). A per-user monthly token budget and the
  per-workspace admission limit (2 concurrent, 100/day) bound spending.
- External agents can write proposals with their own model
  (`change_propose`, MCP prompts `revise-item` / `check-claims`), which costs
  the server nothing.

## Authorization for agents

People in the app hold every scope their role allows. OAuth tokens (MCP/CLI)
get `studio:read/write/propose/ai`; they cannot delete, administer or apply
proposals unless the owner sets `agentApply` to `own_proposals` or `any`.
Every mutation and every denial is written to `audit_events` (identifiers
only). On Vercel, `/mcp` accepts Clerk OAuth access tokens and publishes
RFC 9728 metadata once `MCP_OAUTH_ENABLED=true`; on Sites the gateway handles
OAuth.

## Retention and deletion

Sources and productions are deleted immediately. Deleted workspaces are hidden
at once and purged after 30 days. The daily cron (`/api/cron/retention`)
removes receipts after 7 days, admission records after 30, decided proposals
after 90 and ledgers after 400. Clerk `user.deleted` removes memberships,
starts deletion of solely owned workspaces and pseudonymizes the user's ID.

## Not built yet

Durable background jobs (generation is synchronous within the 60 s function
limit), item-level storage with content-addressed revisions (snapshots are
whole aggregates, bounded by the 256 KB budget), MCP `outputSchema`, a local
agent-connection list with revocation, a Google adapter, additional AI tasks
(channel derivation, brief extraction, claim checking on the server), UI for
settings/deletion/usage, URL crawling, repository sync, publishing, analytics,
rendering and billing. Do not present these as working.

## Verification and local operation

```sh
npm ci
npm run typecheck && npm run lint
npm test            # unit + every *.db.test.ts on Miniflare D1 and libSQL
npm run build:vercel
npm run eval -- --dry-run   # live: set provider keys and drop --dry-run
```

Migrations: `npm run db:migrate:libsql` (Turso) or the Sites package (D1).
Never edit an applied migration.
