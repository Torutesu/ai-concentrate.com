# AI Concentrate studio

Before modifying UI, read design/HANDOFF.md and design/figma-sync.json.
Every implemented UI change must update the corresponding editable Figma screens and affected shared components/tokens in the same task: https://www.figma.com/design/m2RyfqGnGhNIJ7lsEPBuEp/Concentrate
Inspect the existing Figma state first; update known nodes in place, preserve node IDs and designer-owned exploration. Do not rerun design/build-figma.js blindly: it is an initial authoring record, not an automatic synchronizer. Update the sync ledger, source hashes and verification evidence. Report any blocked sync explicitly.

The user approved this sequence: prototype → working AI generation and editing → video production. Current milestone is the prototype. Never describe sample text or prompt export as live generation.

Use the existing Site project in .openai/hosting.json and preserve owner-private access. This synchronization rule is a development completion rule; no background or bidirectional sync is installed.
