# Release readiness — 2026-10-02

## Delivered in this increment
- Agent brief review and channel-specific editorial policy; saved brief propagated to the provider.
- Versioned restore operation and app confirmation dialog; locked text stays protected.
- JSON/Markdown export and validated JSON import into a new production.
- Keyset summary listing, explicit load-more and lazy detail retrieval.
- Language preference persistence; timed requests and broader reload.
- Shared HTTP/MCP operation registry and CLI transport.
- 29 editable Figma implementation views and representative states, with existing IDs and designer explorations preserved.

## External setup required
- AI: no runtime provider secrets configured. Enable OpenAI Developers for approved key provisioning, then configure model and evaluate actual outputs.
- MCP: local discovery and unauthenticated rejection tested; hosted OAuth/plugin connection requires deployment and user connection.

## Still unimplemented (not merely credential setup)
- Public commercial registration/recovery, workspace invitations, billing and account lifecycle.
- URL crawling and repository synchronization; source import currently stores supplied text.
- Social OAuth, scheduling execution and measured analytics.
- Capture, durable render/voice jobs, asset storage and finished video export.
- Full mobile/English Figma state parity and all prototype interactions.
- Unlimited source/proposal/history browsing, full-text search, retention and usage limits.

These are not represented as working capabilities. This release is the private content-editing foundation, not the completed external-sale product. Video follows the working-AI milestone per the approved sequence.

## Evidence
Miniflare integration tests: tenant isolation, roles, concurrent saves, idempotency, locked edits, scoped proposals, stale application, brief propagation, structural review, revision restore, MCP validation and summary pagination. Provider is a test double. Local HTTP `/mcp` lists 12 tools; workspace calls without authentication return 401.
Browser: agent review and inline plan fields observed before the refactor; a native confirmation blocked input during restore testing. Replaced that confirmation with an application dialog. Post-refactor interaction QA remains incomplete until the browser dialog is cleared.
