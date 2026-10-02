# Current product design

## Latest: inline interaction redesign

The current version restructures all eight main tabs around inline work panes. Calendar is a real month/week grid with a post inspector; content retains its list while editing original/X/article/video; agents retain selection while configuring, running and reviewing; integrations have service/account/permission/reconnect states. Splash, shell skeleton, partial results, save failures and confirmation overlays are included.

Authoritative interaction contract: `INTERACTION-SPEC.md`. Latest node ledger: `interaction-state.json` (supplements the earlier figma-state.json). Screenshot: `calendar-interactions.png`. Earlier images/authoring scripts are historical.

Current structural verification: 77 desktop state/reference frames, no out-of-screen text, no clipped text, no broken prototype destinations, Noto Sans JP only, zero image-filled nodes. These are state variants, not 77 application routes. Eight main tabs are placed first; former standalone detail pages are marked Reference and moved below.

Browser playback verified month/week switching, opening a date's reservation overlay, October 8 date propagation and closing back to the calendar. Other controls are representative Figma states and specifications. Drag triggering was rejected by the Figma tool; date-change confirmation is reachable via a button. Hover/timing/keyboard behavior and actual external operations remain implementation acceptance requirements. No app code was changed.

## AI-native production addition

Clueso research and proposed Web/CLI/MCP operation parity: `CLUESO-RESEARCH.md`, `AI-NATIVE-CONTRACT.md`. Editable screen map and prototype limits: `AI-NATIVE-DESIGN.md`. Mutation ledger: `ai-native-state.json`; final structural QA: `ai-native-qa.json` (39 screens/overlays, no text overflow or broken destinations). The existing video editor node is `36:2381`, production plan `60:5167`, and MCP connection `61:5874`. Screenshots `ai-video-editor.png`, `ai-mcp-connection.png`, `ai-linked-guide.png` reflect this addition. No runtime CLI/MCP service or video renderer was implemented.

## Earlier milestone (historical)

Figma: https://www.figma.com/design/m2RyfqGnGhNIJ7lsEPBuEp/Concentrate?node-id=20-830

All 30 current screens live on `03 · Product design — Current` (20:391), in the existing single Concentrate file. Earlier pages are history, not competing current designs. Native editable components and text are preserved.

Latest user correction supersedes the initial Glass & Growth material direction: no full-screen gradients, quiet off-white canvas, white document/cards, deep-green navigation. Glass is limited to secondary button controls. Primary buttons remain opaque green for contrast. No concept education in routine working UI.

Includes product workspaces, URL/Markdown/repository onboarding, product-context review, strategy, marketing workflows, approvals, settings, and representative Japanese/English settings/home states. UI locale is separate from output language. See REQUIREMENTS.md and OKARA-PARITY.md for functional scope and gaps.

Verification: 30 desktop screens, zero text overflowing screen bounds; home and onboarding visually inspected, primary-button contrast corrected and inspected. Earlier structural prototype-route checks passed. Live presentation playback was not tested. English localization is representative, not all screens translated.

This is a Figma design revision only. Application implementation, live integrations, AI and publishing are not changed. Historical screenshots and authoring JS in this directory predate the latest visual correction; they are not rerunnable sync scripts or the current visual source. The Figma nodes and figma-state.json are authoritative.
