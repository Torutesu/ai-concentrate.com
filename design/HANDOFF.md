# AI Concentrate — design handoff

The current milestone is an interactive prototype for ShogunAI marketing, not a production AI service.

## Working flow
Idea library → concentrate editor → channel drafts. Five axes: feature benefit, use case, persona/UGC, mascot, castle. Editing preserves channel drafts independently of the concentrate. Download/upload JSON provides explicit file-based prototype persistence. No live generation, cloud storage, publishing, analytics or video rendering exists yet.

## Figma ownership
File: m2RyfqGnGhNIJ7lsEPBuEp. Implementation screens and shared foundations belong in a clearly named implementation-sync area. Designers should duplicate into their own exploration area before redesigning. Preserve those explorations during future syncs. See figma-sync.json for exact node identities and last synchronized source hashes.

## Future stages

AI-native production revision (2026-10-02): Clueso public research is mapped in `ux-v3/CLUESO-RESEARCH.md`. Thirteen production/integration views and 26 overlays extend the same current Figma page. Existing video node `36:2381` now shows the scene editor; production entry `60:5167`, MCP entry `61:5874`, CLI `61:6042`. The original Content, Integrations and Agents tabs link into these views. Read `ux-v3/AI-NATIVE-CONTRACT.md` and `ux-v3/AI-NATIVE-DESIGN.md` before implementation. Web/CLI/MCP must use the same versioned operations and workspace authorization. `ux-v3/ai-native-state.json` records mutations. This is a design-only revision; CLI, MCP, capture, rendering and integrations are not running.

Commercial entry and navigation revision (2026-10-02): dedicated インテグレーション sidebar entry `22:1305` is separate from workspace/account settings. Registration, login, invitation acceptance, recovery, members, roles and billing designs are recorded in `ux-v3/COMMERCIAL-SPEC.md` and `ux-v3/commercial-state.json`. Read their prototype limitations before implementation. No real authentication, invitation delivery or payment was added.

Latest interaction revision (2026-10-02): eight primary tabs now complete work inline, with month/week calendar, post inspector, content channel editor, agent panel, connection details, splash/loading/recovery and overlays. See `ux-v3/INTERACTION-SPEC.md` and `ux-v3/interaction-state.json` before implementation. These supersede earlier standalone-detail navigation. Browser prototype checks covered month/week, date-to-form and close/return; structural checks passed for all 77 state/reference frames. No production integration or application change occurred.

Current design (2026-10-02): same Figma file, page `03 · Product design — Current` (`20:391`), home `20:830`. Thirty screens cover workspaces, context onboarding, strategy, marketing production and representative Japanese/English UI. See `ux-v3/README.md`, `REQUIREMENTS.md`, `OKARA-PARITY.md` and `figma-state.json`. Latest user direction rejects broad gradients: neutral canvas, white work surfaces, dark green sidebar, glass only on secondary controls. v1/v2 remain historical references. This design is not implemented.

UX design proposal (2026-10-02): Figma page `02 · UX refinement` (`15:918`), entry frame `15:953`. See `ux-v2/README.md` and `ux-v2/figma-state.json`. Ten desktop states refine the project/document/channel workflow. User direction: remove permanent explanations of “concentrate” from the working UI; place concept education in onboarding/help. This proposal is not implemented. Preserve it during implementation-sync updates.

1. Review the present concept and screens.
2. Connect server-side AI, structured generation, revisions, selective regeneration, durable brand/project storage.
3. Connect approved scripts to assets, voice and rendered video; maintain human review before public release.

## Sources
ShogunAI public positioning: https://shogunaios.com/ja (checked 2026-10-02). Content examples are strategic hypotheses, not verified customer results. No customer quote, performance result or claimed integration may be invented.

## Sync mechanism
Sync is performed by the coding agent as part of every UI change, as required by ../AGENTS.md. There is no installed background watcher and no automatic Figma-to-code pipeline.

## Latest review-first revision (2026-10-02)

User explicitly requested reviewing latest Figma before implementation. `ux-v4/README.md` and `ux-v4/figma-state.json` supersede the affected v3 views. Review entry `79:7681` on existing page `20:391`. Strategy, Today, Context, Content navigation, Video, Guide, Locales, Review, Export and Analytics were refined. Object-specific review and recovery states fix semantic misrouting. ShogunAI imagery is dated reference material, not a new recording. Data-filled analytics `80:7751` is explicitly illustrative. Structural and visual checks completed; browser playback was gated by Figma sign-in. No app source or deployment change. Do not begin implementation before user review.

## 2026-10-02 — Implementation authorized

The user explicitly requested implementation with scalable architecture. The older
instruction to wait for design review is now superseded. A working, authenticated
D1-backed studio replaces the browser-local prototype. See `docs/architecture.md`
for the supported slice, tests and external integration boundaries. Editable native
implementation frames are in the same Figma file, under `Implemented / …`, starting
at `89:9207`. Existing exploratory/product-design nodes are preserved.

Every subsequent UI change must update the implementation sync map and applicable
native Figma screens; do not mark all planned designs as shipped. Automatic
background or bidirectional sync is still not installed.

## 2026-10-02 — marketing-agent research integration (local, not deployed)

Reviewed Okara's viral-launch handbook. Added versioned editorial/channel policies and connected saved persona/problem/claim/hypothesis/CTA/destination/metric/review-date fields to the real provider request. Added structural `production_review` through shared operations/MCP, with tenant authorization and explicit unverified-evidence status. See `docs/marketing-agent-quality.md` for research provenance and live-evaluation limits.

Local common operations/MCP/CLI and history-restore work is also present. Ten integration tests and production build pass. Hosted MCP OAuth, real provider quality, and deployment are not verified for this change. No UI nodes changed in this increment; previous full-screen Figma parity remains outstanding and is not claimed complete. Do not present this local increment as a deployed or fully completed product.

## 2026-10-02 — review and history UI (local)
Agent screen now displays selected draft readiness, missing fields, source count and human review criteria using the shared marketing policy. History offers revision restoration via shared operations, with dirty/role/busy guards and confirmation. Locked persisted bodies stay disabled until unlock has been saved.
Figma agent node 89:10254 updated in place; history node 98:8656 added. Native editable layers; explorations preserved. TypeScript, 10 integration tests and build passed; lint has only existing image warnings. Not deployed; browser interaction verification and full planned-screen parity remain outstanding.

## 2026-10-02 — complete implemented-view inventory and release preparation

The implementation-sync area now covers 29 editable native views/states. See `complete-view-state.json` and main ledger for added IDs. Existing design explorations remain untouched. The authoring script records creation; do not blindly rerun it to overwrite designer changes.
Added inline brief fields, JSON import/export, Markdown export, language persistence, timed requests, summary pagination/lazy detail retrieval, explicit unloaded-calendar notice and application-level restore confirmation. MCP exposes 12 shared operations. `docs/release-readiness.md` explicitly separates delivered features, setup dependencies and still-unimplemented commercial/video modules. Never claim those planned modules are shipped.
