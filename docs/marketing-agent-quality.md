# Marketing agent quality

Playbook: `marketing-2026-10-02.1` in `lib/agents/marketing.ts`.
Research input: [Okara launch handbook](https://okara.ai/viral-launch-x-handbook), reviewed 2026-10-02. Its reported outcomes are self-reported, not validation of Concentrate or ShogunAI. We use editorial principles, not its reach numbers, outreach quotas or proposed universal launch times.

## Implemented contract

Every revision receives the saved production's audience, problem, claim, hypothesis, CTA, destination, metric and review date alongside the target channel, locale and source excerpts. Source coverage explicitly reports truncation. Sources remain untrusted; their presence does not verify claims. No cross-workspace retrieval is permitted.

A versioned common policy and separate draft/X/article/Reddit/scene/guide guidance govern the provider request. They favor concrete customer value, supported statements, relevant next actions and measurement. Generated text remains an unapplied proposal protected by revision checks and locks.

`production_review` is available through the common operations registry, HTTP gateway and MCP. It checks missing brief fields and the presence of sources, while explicitly retaining human checks for claim support, first-use experience, channel fit and measurement setup. This is structural readiness, not an accuracy score or performance prediction. It does not block exploratory drafts.

## Validation and remaining evidence

Automated tests verify context propagation, tenant isolation, missing-field reporting and revision protection. They do not prove that an LLM follows every instruction. Live provider evaluation remains pending provider configuration.

Before adopting a new model or policy, compare fixed briefs: sparse product evidence, conflicting sources, unsupported numbers, prompt injection inside sources, Japanese X copy, English Reddit copy and a feature demonstration script. Human reviewers should record unsupported-claim count, preservation of supplied facts, audience specificity, CTA relevance and editing effort. Require no critical fabricated claim in the reviewed sample; report sample size and reviewer uncertainty. A prompt alone is not a factual verifier.

For ShogunAI, begin with founder/PM/freelancer briefs. Measure the path from exposure to visit, registration, first useful result and repeat use. Record actual observations and attribution limits; never fabricate analytics when an integration is disconnected. Compare matched campaigns and keep alternative explanations visible. Promote a tactic into the playbook only after reviewing evidence; do not automatically learn from raw engagement totals.

## Scope

This change modifies backend generation and operations, not visible screens. The complete UI/Figma parity work and external platform integrations remain tracked separately. The local MCP implementation still needs hosted OAuth/plugin verification. No automated publishing or outreach is enabled.

## 2026-10-03 — eval harness
The fixed briefs above now exist as `evals/cases/*.json` (sparse evidence, conflicting sources, unsupported numbers, prompt injection, Japanese X, English Reddit, demo script). `npm run eval` runs them against every configured route (or `--models provider:model,...`) and applies deterministic checks: output language, length, banned phrases, required elements and figures/URLs absent from all inputs. These checks do not judge persuasiveness; keep the human review described above and report sample size. Prompt or model changes must bump the task version in `lib/ai/tasks/item-revise.ts` and attach eval output.
