# AI Concentrate: working studio foundation

## Current boundary

The first production slice replaces the browser-only prototype with authenticated,
workspace-scoped D1 storage. The React views are a client of `/api/v1`; content
validation, access checks, revision checks and proposal application live in
`lib/server/service.ts` and `lib/domain`. SQL is isolated in `Repository`.

This is a modular monolith. Avoid separate services until load or operational
boundaries justify them. Future MCP and CLI transports must call the same service
with a verified actor; do not duplicate authorization or trust an actor ID from a
request body. This release does not expose an MCP server or CLI authentication.

## Data and editing

- A workspace has explicit owner/editor/viewer memberships. Every read and write
  checks membership; cross-workspace IDs return 404.
- A production is one bounded aggregate: message, experiment, dates and up to 100
  text items. It is not the entire workspace. File/video bytes never belong here.
- Saves compare `baseRevision` atomically in D1. The new revision, immutable
  snapshot and idempotency receipt commit in the same transactional batch.
- The same command key and input replay the original response. Reusing a key
  with different input fails. Conflicts retain the client's unsaved text.
- Locked text must be unlocked in a separate saved revision before editing.
- An AI response is an unapplied change proposal. Applying it requires the exact
  original revision and changes only its target item. Later human edits survive.
- Source text is immutable and hashed. AI uses at most eight latest sources,
  at most 10,000 characters each. References are citations/metadata, not fetch jobs.

## Authentication and integrations

Production uses the existing private Sites gateway's verified ChatGPT identity
headers. Never expose the Worker directly without an equivalent trusted gateway
that strips and supplies those headers. Local sign-in is provided by the starter's
development plugin and is not an independent production authentication system.
Cross-origin writes are rejected. All JSON responses use `no-store`; requests are
stream-limited to 300 KB. Secrets are server-only.

OpenAI Responses integration is optional. `OPENAI_API_KEY` and `OPENAI_MODEL` enable
it; neither is stored in source or exposed to the browser. Structured output is
validated. There is a 45-second timeout and no blind retry. Provider failures leave
original text intact. Generation request IDs prevent duplicate calls for the same
request within normal execution. A terminated Worker can leave a `running` receipt;
this is not a durable job queue or an exactly-once provider guarantee.

The UI exposes actual capabilities. URL crawling, repository synchronization,
social OAuth/publishing, real analytics, recording, voice, video rendering, billing,
email invitations and public account signup are not connected. Calendar dates are
planning metadata; no post is scheduled externally. The ShogunAI image is a dated
2026-09-06 reference, not a rendered video or current screen recording.

## Scaling checkpoints

Indexed workspace keys prevent cross-tenant scans. Current lists are deliberately
bounded (100 workspaces/productions/proposals, 50 sources, 30 history entries).
Before increasing these operational bounds, replace list responses with keyset
pagination and lightweight summaries, and load selected content bodies separately.
Do not merely remove the limits. History is retained; pagination is required for
browsing older snapshots. No load benchmark or high-volume capacity claim is made.

Before external sale: complete OAuth/PAT authentication for external clients,
workspace invitations and revocation, rate/usage limits, audit event export,
retention/deletion policy, recovery/export UI and billing. Move provider and render
work to durable jobs with a status API, leases, cancellation and explicit retries.
Keep rendering and file storage behind adapters (R2 + queue); preserve source and
artifact revision links. Do not treat a disconnected capability as completed.

## Verification and local operation

```sh
npm ci
npm run build
npx wrangler d1 execute DB --local --config dist/server/wrangler.json \
  --persist-to .wrangler/state --file drizzle/0000_wonderful_colleen_wing.sql
npm run dev
npm test
npx tsc --noEmit
npm run lint
```

Apply the initial SQL only to a fresh local database. The Sites package includes
Drizzle migrations for the existing project's managed deployment. Do not regenerate
or overwrite an applied migration; add a new migration for schema changes.

Tests use real local D1 through Miniflare: tenant/role isolation, concurrent CAS,
command replay, locked editing, proposal application and stale revision rejection.
The AI provider is a test double in those tests; live provider generation has not
been verified. Browser checks cover workspace creation, source persistence,
editing/save/reload, calendar dates, and Japanese/English switching.

## 2026-10-02 extension

The stateless `/mcp` endpoint and `/api/v1/operations` now share the operations registry and StudioService. Twelve operations support workspace access, sources, paginated production summaries, brief review, versioned saves/restoration and AI revision proposals. Sites owns external OAuth; `cli/concentrate.mjs` consumes an authorized bearer token. Hosting/plugin provisioning and live OAuth must be checked separately from local tool discovery.

The Web production list now uses keyset pages of 20 lightweight summaries and loads the selected aggregate separately. An explicit load-more control warns that older calendar events are not yet loaded. Source/proposal/history bounds remain as documented above; calendar-wide and full-text search indexing are not implemented. A workspace-create replay returns the stored role/name rather than claiming owner privileges.

Markdown and versioned JSON downloads preserve unsaved text. JSON import validates schema/size and creates a separate production, never overwriting an existing ID. UI language persists locally. HTTP requests time out after 60 seconds. Server and provider tests do not replace browser interaction tests.
