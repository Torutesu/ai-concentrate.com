import { DomainError } from "../domain/errors";

export type ModelTier = "fast" | "standard";
export type Effort = "low" | "medium" | "high";

/**
 * Prompt split by stability so providers can cache the prefix:
 * `system` never changes, `context` changes only when workspace knowledge
 * changes, `task` changes on every call.
 */
export type PromptParts = { system: string; context: string; task: string };

export type Usage = {
  /** All input tokens, including cache reads and cache writes. */
  inputTokens: number;
  cachedInputTokens: number;
  cacheWriteTokens: number;
  /** All output tokens, including reasoning. */
  outputTokens: number;
  reasoningTokens: number;
};

export type ProviderRequest = {
  model: string;
  parts: PromptParts;
  /** Strict JSON Schema: every object lists all properties as required. */
  schema: Record<string, unknown>;
  schemaName: string;
  maxOutputTokens: number;
  effort?: Effort;
  /** Groups requests that share the cacheable prefix. */
  cacheKey: string;
  signal: AbortSignal;
};
export type ProviderResult = { output: unknown; usage: Usage; model: string };

export interface ModelProvider {
  readonly id: string;
  generate(request: ProviderRequest): Promise<ProviderResult>;
}

/**
 * `retryable` means another provider may succeed: the failure happened before
 * any output was produced. Output-quality failures are never retried
 * elsewhere, so a weak model cannot hide behind a fallback.
 */
export class ProviderError extends DomainError {
  constructor(
    code: string,
    status: number,
    message: string,
    public retryable: boolean,
    public usage?: Usage,
  ) {
    super(code, status, message);
  }
}

export const emptyUsage = (): Usage => ({
  inputTokens: 0,
  cachedInputTokens: 0,
  cacheWriteTokens: 0,
  outputTokens: 0,
  reasoningTokens: 0,
});

/** Shared mapping from HTTP status to a safe, provider-neutral error. */
export function providerHttpError(status: number) {
  if (status === 401 || status === 403)
    return new ProviderError(
      "PROVIDER_AUTH",
      503,
      "AI credentials or model access need administrator attention.",
      true,
    );
  if (status === 429)
    return new ProviderError(
      "PROVIDER_CAPACITY",
      429,
      "AI provider quota or rate limit reached. Check billing or try again later.",
      true,
    );
  if (status >= 500)
    return new ProviderError(
      "PROVIDER_ERROR",
      502,
      "The AI provider could not complete the request.",
      true,
    );
  return new ProviderError(
    "PROVIDER_REQUEST",
    502,
    "The AI provider rejected the request. Check the model configuration.",
    false,
  );
}
export const providerTimeout = () =>
  new ProviderError(
    "PROVIDER_TIMEOUT",
    504,
    "Generation timed out. Your saved draft is unchanged.",
    true,
  );
export const providerUnavailable = () =>
  new ProviderError(
    "PROVIDER_UNAVAILABLE",
    503,
    "AI provider is unreachable. Try again later.",
    true,
  );
export const outputLimit = (usage?: Usage) =>
  new ProviderError(
    "OUTPUT_LIMIT",
    502,
    "The answer exceeded the output limit. Ask for a smaller change.",
    false,
    usage,
  );
export const filtered = (usage?: Usage) =>
  new ProviderError(
    "FILTERED",
    422,
    "The AI provider declined this request.",
    false,
    usage,
  );
export const invalidOutput = (usage?: Usage) =>
  new ProviderError(
    "INVALID_OUTPUT",
    502,
    "The generated content failed validation.",
    false,
    usage,
  );
export const isAbort = (e: unknown) =>
  e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
