# Release readiness — 2026-10-03

## Delivered in this increment
- Agent brief review and channel-specific editorial policy; saved brief propagated to the provider.
- Versioned restore operation and app confirmation dialog; locked text stays protected.
- JSON/Markdown export and validated JSON import into a new production.
- Keyset summary listing, workspace-wide literal title/body search, explicit load-more and lazy detail retrieval.
- Paginated revision history beyond 30 versions and read-only snapshot preview before restoration.
- Language preference persistence; timed requests and broader reload.
- Shared HTTP/MCP operation registry and CLI transport.
- 29 editable Figma implementation views and representative states, with existing IDs and designer explorations preserved.

## External setup required
- AI: Preview provider key and model are configured. Actual hosted generation and output quality still require verification. Sensitive keys cannot be validated from an empty CLI environment pull.
- MCP: local discovery and unauthenticated rejection tested; hosted OAuth/plugin connection is published; user connection remains unverified.

## Still unimplemented (not merely credential setup)
- Commercial auth hardening, workspace invitations, billing and account lifecycle. Clerk development Google login and authenticated save/reload have been verified.
- URL crawling and repository synchronization; source import currently stores supplied text.
- Social OAuth, scheduling execution and measured analytics.
- Capture, durable render/voice jobs, asset storage and finished video export.
- Full mobile/English Figma state parity and all prototype interactions.
- Source/proposal pagination, indexed/ranked search, retention and account-wide usage accounting.

These are not represented as working capabilities. This release is the private content-editing foundation, not the completed external-sale product. Video follows the working-AI milestone per the approved sequence.

## Evidence
Miniflare integration tests: tenant isolation, roles, concurrent saves, idempotency, locked edits, scoped proposals, stale application, brief propagation, structural review, revision restore, MCP validation and summary pagination. Provider is a test double. Local HTTP `/mcp` lists 14 tools; workspace calls without authentication return 401.
Browser: Desktop Japanese body search, empty result, revision preview and close verified after this change. Previous release verified restoration and language persistence. Mobile/English interaction coverage and download round-trip remain incomplete.

## Search limits
Search is literal substring matching over titles and item bodies, scoped by workspace before returning at most 50 summaries. Japanese substrings and literal `%`/`_` work; this is not tokenized/ranked or indexed full-text search. Large-workspace latency/load tests are not complete. An indexed search projection can replace the repository query without changing Web/CLI/MCP operations. Reuse a cursor only with the same query; concurrent edits may reorder results.

## 2026-10-03 generation reliability
- Atomic workspace admission: at most 2 active generation claims within 120 seconds and 100 attempts in a rolling 24 hours. Failed attempts count; old running claims expire for admission. This is a workspace safety limit, not an account-wide billing cap.
- Existing idempotency behavior remains intact. Provider failures do not overwrite saved content. No automatic provider retry.
- Timeout, connection, credential/model access, quota and other upstream failures return separate safe domain errors without raw provider payloads.
- 16 service/provider tests against each of D1 and libSQL (32 passing); TypeScript and Next production build pass. ESLint: zero errors, 43 existing design-script warnings. No application UI source changes in this increment.

Preview deployed successfully: https://ai-concentrate-4fb4uiag9-torutesus-projects.vercel.app
Observed old preview: server-rendered identity but API requests required re-login.
Root ClerkProvider now maintains session refresh across workspace pages; sign-in
uses this shared provider. Hosted build passed; final authenticated browser check
and live generation remain pending because Dia was actively switched to another task.

## UI polish — 2026-10-03
Preview: https://ai-concentrate-jqtbq8os5-torutesus-projects.vercel.app
- Redesigned operational home, grouped export controls, document/AI composition areas and editable idea title.
- Shared panel/control refinements and fixes for narrow-screen navigation and visually hidden upload-input overflow.
- 32 domain tests pass; Next build and deployed Vercel build pass. Targeted lint: 0 errors, 4 existing image warnings.
- Browser checks on isolated local fixtures: home-to-editor navigation; title change enables save; EN switch; 390px home, plan, draft and six primary views without page-level overflow; export Escape dismissal. This is UI evidence, not hosted auth/provider validation.
- Figma implementation frames updated; source hashes and native node IDs recorded. Visual review covers home/editor; dedicated mobile/EN Figma parity is still incomplete.

## Scalable AI core — 2026-10-03 (local; not deployed)
Implements the non-UI review (`docs/reviews/2026-10-03-non-ui-design-review.md`, status table at its top).
- Size budget in bytes on every write path (fixes unsaveable productions and D1 `SQLITE_TOOBIG`).
- Slim idempotency receipts, summary columns, FTS5 trigram search with incremental indexing, chunked sources, retention purge and deletion (sources, productions, workspaces, accounts).
- Multi-provider AI (OpenAI + Claude) with routing, one pre-output fallback, workspace provider policy, cacheable prompt layout, relevance-bounded context, edit-mode output, redaction, fact warnings, per-attempt ledger and monthly token budget.
- Proposal lifecycle (proposed/applied/rejected/stale) with three-way apply; agent scopes, policy-gated agent apply, audit events; MCP prompts, actionable tool errors, compact responses, `item_patch`/`brief_patch`/`change_propose`; Clerk OAuth token acceptance and RFC 9728 metadata on Vercel.
- CI workflow, eval harness (7 fixed cases), AGENTS.md invariants.
Evidence: `tsc` clean; ESLint 0 errors; 15 unit tests and 36 database tests on each of Miniflare D1 and libSQL pass; Next and Sites builds pass; unauthenticated smoke test of the built server. Not verified: live providers, real MCP OAuth clients, deployed cron/webhook, browser interaction of the three non-visual UI data-layer changes.

## Frontend capabilities — 2026-10-07 (local; not deployed)
The screens now cover the operations that previously had no UI:
- **AI data policy (owner only).** Source sending, agent apply permission, and a provider allow-list.
- **Brand profile.** Voice, glossary and prohibited claims.
- **Usage.** Monthly usage and budget.
- **Workspace and idea deletion.** Both require confirmation.
- **Source management.** AI exclusion, deletion, paging, passage search, and a sensitive-data warning on import.
- **Proposal review.** Word diff, origin, fact warnings, Reject, a check for new proposals, and history filtered by status.

The Web client calls the shared operation registry through a typed `operation()`. Server handlers are typed against the same `OperationResults`, so a changed result shape fails type checking. Errors are localized per display language.

Fixes:
- **Sites runtime (pre-existing).** The Sites Worker bundled the Vercel (Clerk/Turso) runtime because the framework rewrote `@/` imports before the Vite alias applied. Every request would have answered 401. A pre-resolve plugin now forces `lib/platform/sites.ts`, and `npm run check:sites` (also in CI) guards it.
- **Passage search.** It hid AI-excluded sources from people. Now people search everything, and agents still never see excluded sources.
- **Sidebar footer.** It overflowed on short viewports.
- **AI-exclusion toggle.** It is now optimistic, with rollback if the save fails.

Evidence:
- `tsc` clean; ESLint reports 0 errors.
- Tests: 21 unit tests, plus 36 database tests on each of D1 and libSQL.
- Both builds pass, and the Sites bundle check passes.
- Browser E2E passed 15/15 on the local Sites Worker with D1 (`docs/qa/README.md`).

Not verified: live AI providers, Clerk sign-in on Vercel, deployed environments and screen-reader output. **Figma sync is blocked** because the connector is not authorized (see `design/figma-sync.json`). Roadmap: `docs/roadmap/2026-10-07-world-class-plan.md`.

## Production hardening — 2026-10-12 (local; not deployed)
Three independent audits (security, reliability, frontend). Every finding below is fixed and covered by tests:
- **Access.** Production fails closed unless `ACCESS_ALLOWLIST` (user IDs, emails or `@domain`) or `ACCESS_MODE=open` is set, and refused accounts see a page explaining why. OAuth tokens are accepted only when MCP OAuth is enabled.
- **Abuse and cost.**
  - Per-user rate limits: 120 writes per minute and 20 AI calls per 10 minutes, applied to every transport and audited.
  - Caps: 300 ideas and 300 open proposals per workspace.
  - Deleted workspaces count against the owner quota until purged.
  - The last 100 revisions per idea are kept.
  - Deployment-wide monthly AI budget.
  - Fact-warning scan is bounded.
- **Agent policy.**
  - Under "propose only" (the default), agents can no longer edit or reject directly; they must use `change_propose`.
  - Agents never set or clear locks.
  - Agents cannot list, read or search sources that are AI-excluded or blocked by the policy.
- **Prompt integrity.** Untrusted text can no longer open or close the prompt's own sections. A zero-width fence is added in prompts and removed from output, so edits remain exact. Task version is `item.revise@2026-10-12.1`.
- **Data integrity.**
  - AI output and applied proposals respect the 48 KB per-item limit (fixes an idea that could no longer be saved).
  - Apply can no longer race a reject.
  - Concurrent identical proposals no longer cause a 500.
  - Abandoned generation claims close after 2 minutes.
  - Router usage records are no longer misattributed to the provider.
  - A NUL character in search queries no longer causes a 500.
- **Retention.** The purge is time-bounded and resumable: each workspace is erased children-first, and one failure no longer blocks the others. The Sites Worker now has its own daily `scheduled` purge. Account deletion also anonymizes proposal authors and decision makers. Note that open proposals also expire after 90 days.
- **Web security.**
  - Strict `Origin`/`Sec-Fetch-Site` CSRF check and an exact JSON media type.
  - Security headers on both runtimes; framing is denied on Vercel.
  - Constant-time comparison of cron and health secrets.
  - Webhook size is checked before the body is read.
  - 14 unused runtime dependencies and 58 unused UI-kit files removed.
- **Operations.** `/api/health` checks database reachability and the schema (every table and column in `db/schema.ts`, in one portable query). CI now builds Sites, checks the runtime bundle and runs the browser E2E.
- **Frontend.**
  - Cancel in the create-workspace dialog no longer creates a workspace.
  - Focus returns after busy operations and closed dialogs.
  - Errors are shown inside confirmation dialogs.
  - Contrast: muted text is AA on every surface, and control borders reach 3:1.
  - Real toggle buttons instead of fake tabs; a valid glossary structure; localized screen-reader diff markers.
  - A persistent live region announces notices.
  - The page title and heading focus follow each view.
  - Unsaved edits are backed up in the tab and offered for restore after a crash or reload.
  - Leaving settings with unsaved changes asks first.
  - Proposals load per idea, so requests no longer grow with the workspace.
  - Generation waits 75 s, so it outlasts the server's limit, and a lost answer re-reads proposals instead of paying twice.
  - Workspace creation is idempotent on retry.
  - Notices clear themselves.
  - Error boundaries and a not-found page.
  - Fonts load without CSS `@import`; `noindex`.
  - Localized labels.

Evidence:
- `tsc` clean; ESLint 0 errors.
- Tests: 25 unit tests, plus 45 database tests on each of D1 and libSQL.
- Next and Sites builds pass, and the Sites bundle check passes.
- Browser E2E passes 18/18 on the local Sites Worker with D1.
- Eval: dry run only (3/7; the dry run echoes the input and checks the harness). A live eval needs provider keys and is not done.

Not verified: deployed environments, live providers, Clerk allowlist behaviour against a real Clerk tenant, and the Sites platform honouring the cron trigger. **Figma sync is blocked** because the connector is not authorized.
