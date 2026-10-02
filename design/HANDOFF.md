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
