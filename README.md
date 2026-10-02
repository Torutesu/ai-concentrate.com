# AI Concentrate

ShogunAI marketing prototype: an idea concentrate editor that branches into X, article, Reddit, short-video and long-video drafts.

## Current milestone

The user chose this sequence:
1. Review ideas and interactive UI.
2. Connect working AI generation, editing and durable storage.
3. Extend to video production.

Implemented: five sample ideas, axis filters/search, new idea creation, concentrate editing, human-scene and evidence notes, independent channel drafts, prompt copying, JSON download/import. Editing is temporary in memory; download before closing or reloading. Import validates structure and asks before replacing unsaved changes. No API call or public social posting happens.

## Run

Node 22+; `npm ci`, then `npm run dev`. Use the URL printed by the server.
`npx tsc --noEmit` checks types. The Sites build entrypoint prepares production output; private publishing uses the existing `.openai/hosting.json` identity.

## Design

Figma: https://www.figma.com/design/m2RyfqGnGhNIJ7lsEPBuEp/Concentrate?node-id=5-405
See AGENTS.md, design/HANDOFF.md and design/figma-sync.json. Implementation changes must be reflected in Figma in the same task. Design explorations stay separate. There is no automated background or bidirectional sync.

Source fonts: Noto Sans JP, loaded via Google Fonts with local sans-serif fallback. Figma uses Noto Sans JP. The Figma capture helper is development-only and excluded from production.

## Validation

Initial prototype: TypeScript check passed; local route returned HTTP 200; browser checks covered opening an idea, editing a concentrate, switching to channel drafts without overwriting them, category filtering, and mobile layout. Figma is editable native structure, not screenshots: four desktop views, a mobile library, shared components, semantic tokens and text styles. See the synchronization ledger for exact evidence.
