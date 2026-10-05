/**
 * Live evaluation of the item.revise task against real providers.
 *   npm run eval                     # every configured route (standard tier)
 *   npm run eval -- --models openai:gpt-x,anthropic:claude-opus-5-5
 *   npm run eval -- --dry-run        # offline: echoes the current text
 * Spends provider tokens. Results go to evals/results/<timestamp>.json.
 */
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { evalCaseSchema, scoreRevision, type EvalCase } from "../lib/ai/evals";
import { loadAiConfig, costMicros, type ModelRef } from "../lib/ai/config";
import { buildContext, type ContextStore } from "../lib/ai/context";
import {
  REVISE_SCHEMA,
  buildRevisePrompt,
  parseReviseOutput,
  reviseOutputTokens,
  ITEM_REVISE,
} from "../lib/ai/tasks/item-revise";
import { settingsSchema } from "../lib/domain/settings";
import { chunkText } from "../lib/domain/text";
import type { ModelProvider } from "../lib/ai/types";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const modelsArg = args[args.indexOf("--models") + 1];

/** In-memory store so evals use the production context builder unchanged. */
function memoryStore(c: EvalCase): ContextStore {
  const chunks = c.sources
    .flatMap((s) =>
      chunkText(s.body).map((body, ordinal) => ({
        id: 0,
        sourceId: s.id,
        ordinal,
        body,
      })),
    )
    .map((chunk, i) => ({ ...chunk, id: i + 1 }));
  return {
    unchunkedSources: async () => [],
    storeChunks: async () => {},
    searchChunks: async () => chunks,
    leadChunks: async () => chunks.filter((x) => x.ordinal === 0),
  };
}

const config = loadAiConfig(process.env as Record<string, string>);
const echo: ModelProvider = {
  id: "dry-run",
  async generate(request) {
    const body =
      request.parts.task.match(
        /<current_text[^>]*>\n([\s\S]*?)\n<\/current_text>/,
      )?.[1] ?? "";
    return {
      output: { mode: "replace", body: body || "（ドライラン）", edits: [] },
      usage: {
        inputTokens: 0,
        cachedInputTokens: 0,
        cacheWriteTokens: 0,
        outputTokens: 0,
        reasoningTokens: 0,
      },
      model: "echo",
    };
  },
};
const targets: ModelRef[] = dryRun
  ? [{ provider: "dry-run", model: "echo" }]
  : modelsArg && !modelsArg.startsWith("--")
    ? modelsArg.split(",").map((m) => {
        const [provider, ...rest] = m.split(":");
        return { provider, model: rest.join(":") };
      })
    : config.routes.standard;
const providers: Record<string, ModelProvider> = dryRun
  ? { "dry-run": echo }
  : config.providers;
if (!targets.length || targets.some((t) => !providers[t.provider])) {
  console.error(
    "No usable provider. Set OPENAI_*/ANTHROPIC_* keys, pass --models provider:model, or use --dry-run.",
  );
  process.exit(2);
}

const cases = await Promise.all(
  (await readdir("evals/cases"))
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map(async (f) =>
      evalCaseSchema.parse(
        JSON.parse(await readFile(`evals/cases/${f}`, "utf8")),
      ),
    ),
);
const settings = settingsSchema.parse({});
const results = [];
for (const target of targets)
  for (const c of cases) {
    const item = c.production.items.find((i) => i.id === c.itemId)!;
    const context = await buildContext(
      memoryStore(c),
      "eval",
      settings,
      c.production,
      item.title,
      config.contextTokens,
    );
    const parts = buildRevisePrompt({
      production: c.production,
      item,
      instruction: c.instruction,
      context: context.text,
    });
    const started = Date.now();
    let output = "",
      error: string | null = null,
      usage = null;
    try {
      const r = await providers[target.provider].generate({
        model: target.model,
        parts,
        schema: REVISE_SCHEMA,
        schemaName: "revision",
        maxOutputTokens: reviseOutputTokens(item.body),
        effort: target.effort,
        cacheKey: `eval:${c.id}`,
        signal: AbortSignal.timeout(90_000),
      });
      usage = r.usage;
      output = parseReviseOutput(r.output, item.body);
    } catch (e) {
      error = (e as { code?: string }).code ?? String(e);
    }
    const score = error
      ? { pass: false, checks: [] }
      : scoreRevision(c, output);
    results.push({
      case: c.id,
      model: `${target.provider}:${target.model}`,
      pass: score.pass,
      error,
      checks: score.checks,
      latencyMs: Date.now() - started,
      usage,
      costMicros: usage ? costMicros(config.prices, target, usage) : null,
      output,
    });
    const failed = score.checks
      .filter((x) => !x.pass)
      .map((x) => `${x.name}${x.detail ? ` (${x.detail})` : ""}`);
    console.log(
      `${score.pass ? "PASS" : "FAIL"} ${target.provider}:${target.model} ${c.id}${error ? ` error=${error}` : ""}${failed.length ? ` — ${failed.join("; ")}` : ""}`,
    );
  }
const passed = results.filter((r) => r.pass).length;
console.log(
  `\n${passed}/${results.length} passed · task ${ITEM_REVISE.version}`,
);
if (!dryRun) {
  await mkdir("evals/results", { recursive: true });
  const file = `evals/results/${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  await writeFile(
    file,
    JSON.stringify({ task: ITEM_REVISE.version, results }, null, 2),
  );
  console.log(
    `Saved ${file}. Review outputs by hand as well: these checks do not judge persuasiveness.`,
  );
}
process.exitCode = passed === results.length ? 0 : 1;
