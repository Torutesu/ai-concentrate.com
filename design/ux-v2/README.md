# UX refinement — 2026-10-02

Status: Figma design proposal, not implemented or approved. Existing implementation frames and production app were preserved.

File: https://www.figma.com/design/m2RyfqGnGhNIJ7lsEPBuEp/Concentrate?node-id=15-953
Page: `02 · UX refinement` (`15:918`). Exact IDs and mutation evidence: `figma-state.json`.

## Design decisions

- No permanent explanation of “concentrate”, slogans, phase descriptions or promotional heroes inside the working UI. Concept education belongs to optional onboarding and help.
- Global navigation is project-centric. Concentrate, channel drafts and history belong to one project rather than competing global destinations.
- The library exposes title, editorial stage, channels and update time. Resume editing is one action.
- The editor presents the document immediately, with brief, scene and source context beside it. AI edits act on a selection and show a comparison before application.
- Media editing preserves a source revision. Updating the concentrate does not silently overwrite a human-edited channel draft. Revision acceptance returns to the channel editor.
- Short videos use individual timed scenes and an asset checklist rather than a single undifferentiated textarea.
- Empty, generating, generation-error and save-error examples are separate state specifications. They are not permanent explanatory panels.

## Audit evidence

1. Library: `audit-library.png` captured in this task. The large slogan and pickup card displaced the useful project list. Replaced with a compact heading, resume row and status table.
2. Editor: `audit-editor.png` captured in this task. Duplicated project selection and long stacked metadata pushed the body far below the entry point. Replaced with a document-first layout and context rail.
3. Project workflow: inspected source and Figma. Global editor/output entries obscured the current project scope. Replaced with project-local tabs and consistent return paths.

## Review path

Start `01 / 企画`: New idea → Create concentrate → Channel drafts → Review changes → Apply. The X editor also links to the short-video scene editor. The concentrate editor links to selected-paragraph AI comparison → apply → undo.

Ten desktop frames, native editable text/vectors, shared component instances and existing semantic color/spacing tokens. UI snapshots are saved here. No flattened image layers in the Figma design.

## Verification and limits

Screens inspected using fresh Figma screenshots; clipped video actions corrected. Final structural check: ten 1440×960 frames, no text or instance outside screen bounds, zero image nodes. Prototype reaction targets were inspected; live Figma presentation playback was not tested.

This is a static design prototype. Search, filters, brand settings, real text input, generation, durable saving, clipboard and file exports are specifications, not functioning services. The initial library only simulates the first sample project. Mobile refinement and full keyboard/accessibility verification remain implementation/design follow-up work. No claim of WCAG compliance.

## Designer handoff

Keep this page separate from `Page 1` implementation-sync frames. Do not rerun authoring scripts over designer edits. Update exact IDs in place. On an explicit implementation request, implement the accepted screens, then update the implementation sync ledger. Current app source fingerprints remain valid and unchanged.
