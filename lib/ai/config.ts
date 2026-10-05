import { z } from "zod";
import { createAnthropicProvider } from "./anthropic";
import { createOpenAIProvider } from "./openai";
import type { Effort, ModelProvider, ModelTier, Usage } from "./types";

export type ModelRef = {
  provider: string;
  model: string;
  effort?: Effort;
};
/** USD per one million tokens. Unknown prices leave cost empty, never guessed. */
const priceSchema = z
  .object({
    input: z.number().nonnegative(),
    cachedInput: z.number().nonnegative().optional(),
    cacheWrite: z.number().nonnegative().optional(),
    output: z.number().nonnegative(),
  })
  .strict();
type Price = z.infer<typeof priceSchema>;
const effortSchema = z.enum(["low", "medium", "high"]);
const routeSchema = z.array(
  z
    .object({
      provider: z.string().min(1),
      model: z.string().min(1),
      effort: effortSchema.optional(),
    })
    .strict(),
);
const routingSchema = z
  .object({ fast: routeSchema.optional(), standard: routeSchema.optional() })
  .strict();

export type AiConfig = {
  providers: Record<string, ModelProvider>;
  routes: Record<ModelTier, ModelRef[]>;
  prices: Record<string, Price>;
  /** Billable tokens (uncached input + output) per user per calendar month. */
  monthlyTokenBudget: number;
  /** Token budget for retrieved source text in each request. */
  contextTokens: number;
};
export type AiEnv = Partial<
  Record<
    | "OPENAI_API_KEY"
    | "OPENAI_MODEL"
    | "OPENAI_FAST_MODEL"
    | "OPENAI_REASONING_EFFORT"
    | "ANTHROPIC_API_KEY"
    | "ANTHROPIC_MODEL"
    | "ANTHROPIC_FAST_MODEL"
    | "ANTHROPIC_EFFORT"
    | "ANTHROPIC_SERVER_FALLBACK"
    | "AI_PRIMARY_PROVIDER"
    | "AI_ROUTING"
    | "AI_PRICES"
    | "AI_MONTHLY_TOKEN_BUDGET"
    | "AI_CONTEXT_TOKENS",
    string
  >
>;

const DEFAULT_ANTHROPIC_MODEL = "claude-opus-5-5";
const json = <T>(
  raw: string | undefined,
  schema: z.ZodType<T>,
  name: string,
) => {
  if (!raw) return undefined;
  try {
    return schema.parse(JSON.parse(raw));
  } catch {
    throw new Error(`${name} is not valid JSON for its schema.`);
  }
};
const positiveInt = (raw: string | undefined, fallback: number) => {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : fallback;
};

/**
 * Builds providers and per-tier routes from environment variables.
 * Defaults keep the existing OpenAI setup first; a configured Anthropic key adds
 * Claude as primary or fallback. AI_ROUTING overrides the routes entirely.
 */
export function loadAiConfig(
  env: AiEnv,
  transport?: { openai?: typeof fetch; anthropic?: typeof fetch },
): AiConfig {
  const providers: Record<string, ModelProvider> = {};
  const defaults: Record<string, Record<ModelTier, ModelRef>> = {};
  if (env.OPENAI_API_KEY && env.OPENAI_MODEL) {
    providers.openai = createOpenAIProvider(
      env.OPENAI_API_KEY,
      transport?.openai,
    );
    const effort = effortSchema.safeParse(env.OPENAI_REASONING_EFFORT);
    const e = effort.success ? effort.data : undefined;
    defaults.openai = {
      standard: { provider: "openai", model: env.OPENAI_MODEL, effort: e },
      fast: {
        provider: "openai",
        model: env.OPENAI_FAST_MODEL || env.OPENAI_MODEL,
        effort: e && "low",
      },
    };
  }
  if (env.ANTHROPIC_API_KEY) {
    providers.anthropic = createAnthropicProvider(env.ANTHROPIC_API_KEY, {
      serverFallback: env.ANTHROPIC_SERVER_FALLBACK !== "off",
      fetch: transport?.anthropic,
    });
    const model = env.ANTHROPIC_MODEL || DEFAULT_ANTHROPIC_MODEL;
    const configured = effortSchema.safeParse(env.ANTHROPIC_EFFORT);
    // Effort is sent only for the default model or when explicitly configured:
    // some models reject the parameter.
    const effortFor = (tier: ModelTier): Effort | undefined =>
      configured.success
        ? tier === "fast"
          ? "low"
          : configured.data
        : env.ANTHROPIC_MODEL
          ? undefined
          : tier === "fast"
            ? "low"
            : "medium";
    defaults.anthropic = {
      standard: { provider: "anthropic", model, effort: effortFor("standard") },
      fast: {
        provider: "anthropic",
        model: env.ANTHROPIC_FAST_MODEL || model,
        effort: env.ANTHROPIC_FAST_MODEL ? undefined : effortFor("fast"),
      },
    };
  }
  const order = Object.keys(defaults).sort((a, b) =>
    a === env.AI_PRIMARY_PROVIDER ? -1 : b === env.AI_PRIMARY_PROVIDER ? 1 : 0,
  );
  const routing = json(env.AI_ROUTING, routingSchema, "AI_ROUTING");
  const route = (tier: ModelTier) =>
    (routing?.[tier] ?? order.map((p) => defaults[p][tier])).filter(
      (m) => providers[m.provider],
    );
  return {
    providers,
    routes: { fast: route("fast"), standard: route("standard") },
    prices: json(env.AI_PRICES, z.record(priceSchema), "AI_PRICES") ?? {},
    monthlyTokenBudget: positiveInt(env.AI_MONTHLY_TOKEN_BUDGET, 2_000_000),
    contextTokens: positiveInt(env.AI_CONTEXT_TOKENS, 6_000),
  };
}

/** Cost in USD micros, or null when the model's price is not configured. */
export function costMicros(
  prices: AiConfig["prices"],
  ref: ModelRef,
  usage: Usage,
) {
  const price = prices[`${ref.provider}:${ref.model}`];
  if (!price) return null;
  const uncached =
    usage.inputTokens - usage.cachedInputTokens - usage.cacheWriteTokens;
  return Math.round(
    uncached * price.input +
      usage.cachedInputTokens * (price.cachedInput ?? price.input) +
      usage.cacheWriteTokens * (price.cacheWrite ?? price.input) +
      usage.outputTokens * price.output,
  );
}
