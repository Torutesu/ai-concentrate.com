# AI Concentrate — design handoff

The current milestone is an interactive prototype for ShogunAI marketing, not a production AI service.

## Working flow
Idea library → concentrate editor → channel drafts. Five axes: feature benefit, use case, persona/UGC, mascot, castle. Editing preserves channel drafts independently of the concentrate. Download/upload JSON provides explicit file-based prototype persistence. No live generation, cloud storage, publishing, analytics or video rendering exists yet.

## Figma ownership
File: m2RyfqGnGhNIJ7lsEPBuEp. Implementation screens and shared foundations belong in a clearly named implementation-sync area. Designers should duplicate into their own exploration area before redesigning. Preserve those explorations during future syncs. See figma-sync.json for exact node identities and last synchronized source hashes.

## Future stages
1. Review the present concept and screens.
2. Connect server-side AI, structured generation, revisions, selective regeneration, durable brand/project storage.
3. Connect approved scripts to assets, voice and rendered video; maintain human review before public release.

## Sources
ShogunAI public positioning: https://shogunaios.com/ja (checked 2026-10-02). Content examples are strategic hypotheses, not verified customer results. No customer quote, performance result or claimed integration may be invented.

## Sync mechanism
Sync is performed by the coding agent as part of every UI change, as required by ../AGENTS.md. There is no installed background watcher and no automatic Figma-to-code pipeline.
