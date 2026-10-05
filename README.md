# AI Concentrate

ShogunAI marketing studio: an idea "concentrate" (brief + draft) that branches into X, article, Reddit, scene and step drafts, edited by people and AI agents through the same versioned operations.

## Current milestone

The user chose this sequence:
1. Review ideas and interactive UI.
2. Connect working AI generation, editing and durable storage.
3. Extend to video production.

Implemented: authenticated workspaces with durable storage (Turso/libSQL on Vercel, D1 on the private Sites deployment), revisioned productions with locks and restore, indexed search, source documents, AI revision proposals through OpenAI or Claude with review before applying, and the same operations over HTTP, MCP and a CLI. Publishing, analytics, rendering and billing are not connected. Never describe sample text or prompt export as live generation. Details and limits: `docs/architecture.md`, `docs/release-readiness.md`.

## Run

Node 22; `npm ci`, then `npm run dev:vercel` (Vercel runtime) or `npm run dev` (Sites runtime). Configuration: `deployment/VERCEL.md`.

Checks: `npm run typecheck`, `npm run lint`, `npm test` (unit tests plus database tests on both Miniflare D1 and libSQL), `npm run build:vercel`, `npm run eval -- --dry-run`. CI runs the same on every push.

## Design

Figma: https://www.figma.com/design/m2RyfqGnGhNIJ7lsEPBuEp/Concentrate?node-id=5-405
See AGENTS.md, design/HANDOFF.md and design/figma-sync.json. Implementation changes must be reflected in Figma in the same task. Design explorations stay separate. There is no automated background or bidirectional sync.

Source fonts: Noto Sans JP, loaded via Google Fonts with local sans-serif fallback. Figma uses Noto Sans JP. The Figma capture helper is development-only and excluded from production.
