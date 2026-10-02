# Concentrate — Glass & Growth

2026-10-02 / Figma design proposal. No production implementation or actual service integration was performed.

## Product structure

One product per workspace. The user can manage many workspaces under the same account. Product context, source credentials, brand voice, strategy revisions, assets, drafts, agents, schedules, members, spending limits and metrics belong to that workspace. Switching must retain each workspace's state and clearly identify which product/account any action will affect. No cross-product retrieval unless a user explicitly imports selected information.

Keep the original editorial model: idea → concentrate → human scene/point-of-view edits → channel-specific production. Extend upstream to source understanding and strategy, and downstream to publication, measurement and iteration. Feature benefits, use cases, personas/UGC, mascot and castle remain planning axes, not competing global navigation.

## Context onboarding

1. Create/name workspace. A URL, Markdown file or selected repository can be the initial source; do not require all three.
2. Show independent import states, sources, last-read times, content revisions and partial success. Allow retry, edit, exclude and resume. Persist input before starting a background job.
3. Extract product brief, customers, use cases, benefits, pricing, supported capabilities, positioning, voice and competitors with source links. Separate observed facts, user-provided facts and AI hypotheses. Code presence is not proof of a shipped capability.
4. Let the user correct product understanding. Missing evidence remains unknown and must not silently become an advertising claim.
5. Ask market, content languages, growth objective, planning horizon, available time and budget. Defaults are editable; baseline metrics may be unavailable.
6. Propose a strategy, explaining channel priority, expected effort, experiment and success metric. Confirm before activating production. Connect only the channels needed for the next action.
7. Re-import on demand or configured schedules. Review changes and their effect on strategy/drafts. Retain manual edits and revision history.

GitHub context reads use selected repositories, branch/ref and file paths. Exclude secrets/build output. Context-reading permission and technical-SEO PR-writing permission are separate. Support repository authorization expiry, revoked access, missing branches, and no readable documents.

## Language model

- `user.uiLocale`: application navigation, forms, notifications and dates; initially `ja` and `en`. Preserve the current route, workspace and unsaved form state when changing it.
- `workspace.targetMarkets`, `workspace.defaultContentLocales`: market strategy and default production languages; independent of UI locale.
- `artifact.locale`, `artifact.market`, `artifact.sourceRevision`: each derivative has explicit language/market and provenance. A UI switch never translates existing content.
- Store strings by stable message key; ICU-style parameters, pluralization and locale-aware number/date formats. Avoid concatenating translated fragments. Use BCP 47 identifiers to add locales without changing the domain model.
- Japanese UI with English output, English UI with Japanese drafts, and bilingual outputs from one concentrate are required acceptance cases.
- Localize the message, examples and CTA for the target market rather than blindly translating. User can compare, edit and approve. Brand vocabulary and prohibited claims apply per locale.
- Missing UI translations fall back predictably; translation failures never overwrite the source. Allow longer English labels, multiline fields, keyboard focus and reduced-transparency styling.

## Design system

The latest user correction supersedes the original glass-heavy proposal: quiet off-white canvas, white opaque document/cards, deep-green navigation and restrained glass only on secondary controls. No broad gradients. Noto Sans JP, existing semantic tokens and editable components remain. See INTERACTION-SPEC.md for the current inline-workspace design and full state requirements.

## Completion criteria for future implementation

Actual parity requires executable, tested capabilities—not a button or an agent card. Every feature below must have persistence, error handling, permission checks, execution records, appropriate external-service connection, cancellation/retry semantics, and measurable acceptance results. The current milestone only supplies the design and coverage requirements. See OKARA-PARITY.md.

## Prototype scope

30 desktop screens: workspace selection; sources; repository scope; import progress; product review; goals; strategy; home; context; agents; library; editor; video; calendar; analytics; integrations; settings; chat; community; technical fix; creators; execution review; market localization; automation; tools; render review; PR review; creator outreach review; English home; English settings.

Core navigation and onboarding links are configured in Figma. Inputs, selection menus, network jobs, generation, publication, credits, invitations and payments are not real operations. English home/settings demonstrate locale behavior; this is not a claim that all prototype screens or the deployed app have been internationalized. Existing v1/v2 Figma pages and live application are preserved.
