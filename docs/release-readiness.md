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
