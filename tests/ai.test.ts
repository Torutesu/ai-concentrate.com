import { test } from "node:test";
import assert from "node:assert/strict";
import { createOpenAIProvider } from "../lib/ai/openai";
import { createAnthropicProvider } from "../lib/ai/anthropic";
import { costMicros, loadAiConfig, type AiConfig } from "../lib/ai/config";
import { runTask, type AttemptRecord } from "../lib/ai/router";
import { ProviderError, type ProviderRequest } from "../lib/ai/types";
import { redact, detectSensitive } from "../lib/ai/redact";
import { unsupportedFacts } from "../lib/ai/warnings";
import { retrievalQuery } from "../lib/ai/context";
import {
  REVISE_SCHEMA,
  buildRevisePrompt,
  parseReviseOutput,
  reviseOutputTokens,
  reviseTier,
} from "../lib/ai/tasks/item-revise";
import { applyEdits, chunkText, estimateTokens } from "../lib/domain/text";
import { newProduction } from "../lib/domain/seed";
import { settingsSchema } from "../lib/domain/settings";
import { usage } from "./helpers";

const request = (
  overrides: Partial<ProviderRequest> = {},
): ProviderRequest => ({
  model: "m",
  parts: { system: "SYSTEM", context: "CONTEXT", task: "TASK" },
  schema: REVISE_SCHEMA as unknown as Record<string, unknown>,
  schemaName: "revision",
  maxOutputTokens: 1000,
  cacheKey: "ws:w:abc",
  signal: AbortSignal.timeout(5000),
  ...overrides,
});
const policy = settingsSchema.parse({}).policy;

test("OpenAI: stable parts first, cache key, strict schema, usage", async () => {
  let sent: Record<string, unknown> = {};
  const provider = createOpenAIProvider("key", async (_url, init) => {
    sent = JSON.parse(String(init?.body));
    return Response.json({
      status: "completed",
      model: "m-2026",
      output: [
        {
          content: [
            {
              type: "output_text",
              text: '{"mode":"replace","body":"確認済み","edits":[]}',
            },
          ],
        },
      ],
      usage: {
        input_tokens: 1200,
        input_tokens_details: { cached_tokens: 1000 },
        output_tokens: 30,
        output_tokens_details: { reasoning_tokens: 5 },
      },
    });
  });
  const result = await provider.generate(request({ effort: "low" }));
  assert.equal(sent.instructions, "SYSTEM");
  assert.equal(sent.store, false);
  assert.equal(sent.prompt_cache_key, "ws:w:abc");
  assert.deepEqual(sent.reasoning, { effort: "low" });
  const input = sent.input as { content: { text: string }[] }[];
  assert.deepEqual(
    input.map((m) => m.content[0].text),
    ["CONTEXT", "TASK"],
  );
  assert.equal(
    (sent.text as { format: { strict: boolean } }).format.strict,
    true,
  );
  assert.deepEqual(result.usage, {
    inputTokens: 1200,
    cachedInputTokens: 1000,
    cacheWriteTokens: 0,
    outputTokens: 30,
    reasoningTokens: 5,
  });
  assert.equal(result.model, "m-2026");
});

test("OpenAI: errors are safe, classified and say whether another provider may help", async () => {
  for (const [status, code, retryable] of [
    [401, "PROVIDER_AUTH", true],
    [429, "PROVIDER_CAPACITY", true],
    [500, "PROVIDER_ERROR", true],
    [400, "PROVIDER_REQUEST", false],
  ] as const) {
    const provider = createOpenAIProvider(
      "key",
      async () => new Response("private upstream content", { status }),
    );
    await assert.rejects(provider.generate(request()), (e: unknown) => {
      assert.ok(e instanceof ProviderError);
      assert.equal(e.code, code);
      assert.equal(e.retryable, retryable);
      assert.ok(!e.message.includes("private"));
      return true;
    });
  }
  const timeout = createOpenAIProvider("key", async () => {
    throw new DOMException("private", "TimeoutError");
  });
  await assert.rejects(timeout.generate(request()), {
    code: "PROVIDER_TIMEOUT",
  });
  const truncated = createOpenAIProvider("key", async () =>
    Response.json({
      status: "incomplete",
      incomplete_details: { reason: "max_output_tokens" },
      usage: { input_tokens: 5, output_tokens: 1000 },
    }),
  );
  await assert.rejects(truncated.generate(request()), (e: unknown) => {
    assert.equal((e as ProviderError).code, "OUTPUT_LIMIT");
    assert.equal(
      (e as ProviderError).usage?.outputTokens,
      1000,
      "usage of failed attempts is kept for accounting",
    );
    return true;
  });
});

const claudeMessage = (overrides: Record<string, unknown> = {}) => ({
  id: "msg_1",
  type: "message",
  role: "assistant",
  model: "claude-opus-5-5",
  content: [
    {
      type: "text",
      text: '{"mode":"edits","body":"","edits":[{"find":"a","replace":"b"}]}',
    },
  ],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: {
    input_tokens: 50,
    output_tokens: 20,
    cache_read_input_tokens: 900,
    cache_creation_input_tokens: 100,
  },
  ...overrides,
});

test("Anthropic: cache breakpoints, structured output, effort and server-side fallback", async () => {
  const calls: {
    url: string;
    headers: Headers;
    body: Record<string, unknown>;
  }[] = [];
  const fakeFetch = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    calls.push({
      url: String(url),
      headers: new Headers(init?.headers),
      body: JSON.parse(String(init?.body)),
    });
    return Response.json(claudeMessage());
  }) as typeof fetch;
  const provider = createAnthropicProvider("key", { fetch: fakeFetch });
  const result = await provider.generate(
    request({ model: "claude-opus-5-5", effort: "medium" }),
  );
  const [{ body, headers, url }] = calls;
  assert.deepEqual(body.system, [
    { type: "text", text: "SYSTEM", cache_control: { type: "ephemeral" } },
  ]);
  const content = (body.messages as { content: Record<string, unknown>[] }[])[0]
    .content;
  assert.deepEqual(content[0], {
    type: "text",
    text: "CONTEXT",
    cache_control: { type: "ephemeral" },
  });
  assert.deepEqual(content[1], { type: "text", text: "TASK" });
  assert.deepEqual(body.output_config, {
    format: { type: "json_schema", schema: REVISE_SCHEMA },
    effort: "medium",
  });
  assert.equal(body.tool_choice, undefined, "no forced tool use");
  assert.equal(body.fallbacks, "default");
  assert.match(
    headers.get("anthropic-beta") ?? "",
    /server-side-fallback-2026-07-01/,
  );
  assert.match(url, /\/v1\/messages/);
  assert.ok((body.max_tokens as number) > 1000, "room for adaptive thinking");
  assert.deepEqual(result.usage, {
    inputTokens: 1050,
    cachedInputTokens: 900,
    cacheWriteTokens: 100,
    outputTokens: 20,
    reasoningTokens: 0,
  });

  await provider.generate(request({ model: "claude-haiku-4-5" }));
  assert.equal(
    calls[1].body.fallbacks,
    undefined,
    "fallbacks only for models that support them",
  );
  assert.equal(
    (calls[1].body.output_config as { effort?: string }).effort,
    undefined,
  );
});

test("Anthropic: refusal, truncation and HTTP errors map to provider-neutral errors", async () => {
  const respond = (payload: unknown, status = 200) =>
    createAnthropicProvider("key", {
      fetch: (async () => Response.json(payload, { status })) as typeof fetch,
    });
  await assert.rejects(
    respond(claudeMessage({ stop_reason: "refusal", content: [] })).generate(
      request(),
    ),
    { code: "FILTERED" },
  );
  await assert.rejects(
    respond(claudeMessage({ stop_reason: "max_tokens" })).generate(request()),
    { code: "OUTPUT_LIMIT" },
  );
  await assert.rejects(
    respond(
      {
        type: "error",
        error: { type: "rate_limit_error", message: "private" },
      },
      429,
    ).generate(request()),
    { code: "PROVIDER_CAPACITY" },
  );
  await assert.rejects(
    respond(
      {
        type: "error",
        error: { type: "overloaded_error", message: "private" },
      },
      529,
    ).generate(request()),
    (e: unknown) =>
      (e as ProviderError).code === "PROVIDER_ERROR" &&
      (e as ProviderError).retryable,
  );
});

test("config: OpenAI stays primary by default, Claude is the fallback, routing is overridable", () => {
  const both = loadAiConfig({
    OPENAI_API_KEY: "o",
    OPENAI_MODEL: "gpt-x",
    ANTHROPIC_API_KEY: "a",
  });
  assert.deepEqual(both.routes.standard, [
    { provider: "openai", model: "gpt-x", effort: undefined },
    { provider: "anthropic", model: "claude-opus-5-5", effort: "medium" },
  ]);
  assert.equal(both.routes.fast[1].effort, "low");
  const claudeFirst = loadAiConfig({
    OPENAI_API_KEY: "o",
    OPENAI_MODEL: "gpt-x",
    ANTHROPIC_API_KEY: "a",
    AI_PRIMARY_PROVIDER: "anthropic",
  });
  assert.equal(claudeFirst.routes.standard[0].provider, "anthropic");
  const custom = loadAiConfig({
    ANTHROPIC_API_KEY: "a",
    ANTHROPIC_MODEL: "claude-haiku-4-5",
  });
  assert.equal(
    custom.routes.standard[0].effort,
    undefined,
    "no effort for explicitly chosen models",
  );
  const routed = loadAiConfig({
    OPENAI_API_KEY: "o",
    OPENAI_MODEL: "gpt-x",
    AI_ROUTING: JSON.stringify({
      fast: [{ provider: "openai", model: "gpt-mini" }],
      standard: [{ provider: "unconfigured", model: "z" }],
    }),
    AI_PRICES: JSON.stringify({
      "openai:gpt-mini": { input: 0.5, cachedInput: 0.05, output: 2 },
    }),
    AI_MONTHLY_TOKEN_BUDGET: "123",
  });
  assert.deepEqual(routed.routes.fast, [
    { provider: "openai", model: "gpt-mini" },
  ]);
  assert.deepEqual(
    routed.routes.standard,
    [],
    "routes to unconfigured providers are dropped",
  );
  assert.equal(routed.monthlyTokenBudget, 123);
  assert.equal(
    costMicros(
      routed.prices,
      { provider: "openai", model: "gpt-mini" },
      usage(1000, 100, 800),
    ),
    340,
  );
  assert.equal(
    costMicros(
      routed.prices,
      { provider: "openai", model: "unknown" },
      usage(),
    ),
    null,
  );
  assert.throws(() => loadAiConfig({ AI_ROUTING: "{bad" }), /AI_ROUTING/);
  assert.deepEqual(loadAiConfig({}).providers, {});
});

function scripted(outcomes: Record<string, () => Promise<unknown>>): AiConfig {
  const providers = Object.fromEntries(
    Object.entries(outcomes).map(([id, outcome]) => [
      id,
      {
        id,
        generate: async () => ({
          output: await outcome(),
          usage: usage(),
          model: `${id}-model`,
        }),
      },
    ]),
  );
  const route = Object.keys(outcomes).map((provider) => ({
    provider,
    model: `${provider}-model`,
  }));
  return {
    providers,
    routes: { fast: route, standard: route },
    prices: {},
    monthlyTokenBudget: 1e6,
    contextTokens: 1000,
  };
}
const task = {
  tier: "standard" as const,
  parts: { system: "s", context: "", task: "t" },
  schema: {},
  schemaName: "x",
  maxOutputTokens: 100,
  cacheKey: "k",
  policy,
};

test("router falls back once on failures before output and records every attempt", async () => {
  const records: AttemptRecord[] = [];
  const config = scripted({
    a: async () => {
      throw new ProviderError("PROVIDER_CAPACITY", 429, "busy", true);
    },
    b: async () => ({ ok: true }),
  });
  const { result, ref, attempt } = await runTask(
    config,
    task,
    async (r) => void records.push(r),
  );
  assert.deepEqual(result.output, { ok: true });
  assert.equal(ref.provider, "b");
  assert.equal(attempt, 2);
  assert.deepEqual(
    records.map((r) => [r.ref.provider, r.error?.code ?? "ok"]),
    [
      ["a", "PROVIDER_CAPACITY"],
      ["b", "ok"],
    ],
  );
});

test("router never hides bad output behind a fallback and respects workspace policy", async () => {
  let secondCalled = false;
  const config = scripted({
    a: async () => {
      throw new ProviderError("INVALID_OUTPUT", 502, "bad", false);
    },
    b: async () => {
      secondCalled = true;
      return {};
    },
  });
  await assert.rejects(
    runTask(config, task, async () => {}),
    { code: "INVALID_OUTPUT" },
  );
  assert.equal(secondCalled, false);
  const onlyB = await runTask(
    config,
    { ...task, policy: { ...policy, allowedProviders: ["b"] } },
    async () => {},
  );
  assert.equal(onlyB.ref.provider, "b");
  await assert.rejects(
    runTask(
      config,
      { ...task, policy: { ...policy, allowedProviders: ["c"] } },
      async () => {},
    ),
    { code: "AI_POLICY" },
  );
  await assert.rejects(
    runTask(scripted({}), task, async () => {}),
    { code: "AI_NOT_CONFIGURED" },
  );
});

test("router skips a fallback that could not finish before the deadline", async () => {
  let now = 0;
  const config = scripted({
    a: async () => {
      now += 45_000;
      throw new ProviderError("PROVIDER_TIMEOUT", 504, "slow", true);
    },
    b: async () => ({}),
  });
  await assert.rejects(
    runTask(
      config,
      task,
      async () => {},
      () => now,
    ),
    { code: "PROVIDER_TIMEOUT" },
  );
});

test("revise task: edits mode, schema-valid output and tiering", () => {
  assert.equal(
    parseReviseOutput({ mode: "replace", body: "new", edits: [] }, "old"),
    "new",
  );
  assert.equal(
    parseReviseOutput(
      { mode: "edits", body: "", edits: [{ find: "old", replace: "new" }] },
      "an old text",
    ),
    "an new text",
  );
  assert.throws(() =>
    parseReviseOutput({ mode: "replace", body: "", edits: [] }, "x"),
  );
  assert.throws(
    () =>
      parseReviseOutput(
        { mode: "edits", body: "", edits: [{ find: "zz", replace: "y" }] },
        "x",
      ),
    { code: "EDIT_NOT_FOUND" },
  );
  const p = newProduction("Title");
  const item = { ...p.items[0], kind: "x" as const, body: "short" };
  assert.equal(reviseTier(item), "fast");
  assert.equal(reviseTier({ ...item, kind: "article" }), "standard");
  assert.equal(reviseOutputTokens(""), 1024);
  assert.ok(reviseOutputTokens("あ".repeat(5000)) >= 7500);
  const parts = buildRevisePrompt({
    production: p,
    item,
    instruction: "Make it punchy",
    context: "CTX",
  });
  assert.ok(
    parts.task.endsWith("<instruction>\nMake it punchy\n</instruction>"),
    "instruction is last",
  );
  assert.equal(parts.context, "CTX");
});

test("text utilities: unique edits, chunk boundaries, token estimates", () => {
  assert.throws(() => applyEdits("a a", [{ find: "a", replace: "b" }]), {
    code: "EDIT_AMBIGUOUS",
  });
  assert.equal(
    applyEdits("abc", [
      { find: "b", replace: "x" },
      { find: "x", replace: "yy" },
    ]),
    "ayyc",
  );
  const text = ("段落です。".repeat(100) + "\n\n").repeat(10);
  const chunks = chunkText(text);
  assert.ok(chunks.length > 1 && chunks.every((c) => c.length <= 1600));
  assert.equal(chunks.join("").replace(/\s/g, ""), text.replace(/\s/g, ""));
  assert.equal(estimateTokens("日本語"), 3);
  assert.equal(estimateTokens("abcdefgh"), 2);
});

test("redaction removes credentials and contact data; detection reports kinds only", () => {
  const input =
    "key sk-proj-ABCDEFGHIJKLMNOPQRSTUVWX mail a.b@example.co.jp tel 03-1234-5678 AKIAABCDEFGHIJKLMNOP";
  const { text, count } = redact(input);
  assert.equal(count, 4);
  assert.doesNotMatch(text, /sk-proj|example\.co\.jp|1234-5678|AKIA/);
  assert.deepEqual(detectSensitive(input).sort(), [
    "api_key",
    "email",
    "phone",
  ]);
  assert.deepEqual(detectSensitive("2026-10-03 の計画"), []);
});

test("fact warnings flag figures and URLs absent from every input", () => {
  assert.deepEqual(
    unsupportedFacts("売上が40%増加。詳細は https://evil.test", ["売上"]),
    ["url:https://evil.test", "figure:40%"],
  );
  assert.deepEqual(
    unsupportedFacts("3つの案、30%改善", ["30％改善の実績"]),
    [],
    "full-width input and single digits are fine",
  );
});

test("retrieval query is a bounded trigram OR query", () => {
  const q = retrievalQuery("判断の理由 resume work");
  assert.match(q, /"判断の" OR "断の理"/);
  assert.match(q, /"resume"/);
  assert.ok(q.split(" OR ").length <= 32);
  assert.equal(retrievalQuery("a b"), "");
});
