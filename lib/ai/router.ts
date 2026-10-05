import { DomainError } from "../domain/errors";
import type { AiPolicy } from "../domain/settings";
import { type AiConfig, type ModelRef, costMicros } from "./config";
import {
  type ModelTier,
  type PromptParts,
  type ProviderResult,
  ProviderError,
  providerUnavailable,
} from "./types";

export type RunMeta = {
  task: string;
  taskVersion: string;
  contextHash: string;
  redactions: number;
};
export type AttemptRecord = {
  ref: ModelRef;
  attempt: number;
  result?: ProviderResult;
  error?: ProviderError;
  latencyMs: number;
  costMicros: number | null;
};
export type TaskRequest = {
  tier: ModelTier;
  parts: PromptParts;
  schema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens: number;
  cacheKey: string;
  policy: AiPolicy;
};

/** Total time for all attempts; stays below the 60 s function limit. */
const DEADLINE_MS = 50_000;
const ATTEMPT_MS = 45_000;
/** A fallback attempt needs at least this much time to be worth starting. */
const MIN_FALLBACK_MS = 12_000;

export function candidates(
  config: AiConfig,
  tier: ModelTier,
  policy: AiPolicy,
) {
  const allowed = policy.allowedProviders;
  const list = (
    config.routes[tier].length ? config.routes[tier] : config.routes.standard
  ).filter((m) => !allowed || allowed.includes(m.provider));
  if (!list.length)
    throw new DomainError(
      Object.keys(config.providers).length ? "AI_POLICY" : "AI_NOT_CONFIGURED",
      Object.keys(config.providers).length ? 403 : 503,
      Object.keys(config.providers).length
        ? "This workspace's AI policy allows no configured provider."
        : "AI generation requires server-side provider configuration.",
    );
  return list;
}

/**
 * Runs one structured-output request with at most one cross-provider fallback.
 * Fallback happens only for failures before any output (connection, timeout,
 * 429, 5xx, credentials); invalid or refused output is returned as an error.
 * Every attempt is reported to `record`, including failed ones.
 */
export async function runTask(
  config: AiConfig,
  request: TaskRequest,
  record: (attempt: AttemptRecord) => Promise<void>,
  clock: () => number = Date.now,
): Promise<{ result: ProviderResult; ref: ModelRef; attempt: number }> {
  const list = candidates(config, request.tier, request.policy).slice(0, 2);
  const deadline = clock() + DEADLINE_MS;
  let lastError: ProviderError = providerUnavailable();
  for (const [index, ref] of list.entries()) {
    const remaining = deadline - clock();
    if (index > 0 && remaining < MIN_FALLBACK_MS) break;
    const started = clock();
    try {
      const result = await config.providers[ref.provider].generate({
        model: ref.model,
        parts: request.parts,
        schema: request.schema,
        schemaName: request.schemaName,
        maxOutputTokens: request.maxOutputTokens,
        effort: ref.effort,
        cacheKey: request.cacheKey,
        signal: AbortSignal.timeout(Math.min(ATTEMPT_MS, remaining)),
      });
      const served = { ...ref, model: result.model };
      await record({
        ref: served,
        attempt: index + 1,
        result,
        latencyMs: clock() - started,
        costMicros: costMicros(config.prices, ref, result.usage),
      });
      return { result, ref: served, attempt: index + 1 };
    } catch (e) {
      const error =
        e instanceof ProviderError
          ? e
          : new ProviderError(
              "PROVIDER_ERROR",
              502,
              "The AI provider failed.",
              false,
            );
      await record({
        ref,
        attempt: index + 1,
        error,
        latencyMs: clock() - started,
        costMicros: error.usage
          ? costMicros(config.prices, ref, error.usage)
          : null,
      });
      lastError = error;
      if (!error.retryable) throw error;
    }
  }
  throw lastError;
}
