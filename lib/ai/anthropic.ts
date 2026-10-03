import Anthropic from "@anthropic-ai/sdk";
import {
  type ModelProvider,
  type Usage,
  filtered,
  invalidOutput,
  isAbort,
  outputLimit,
  providerHttpError,
  providerTimeout,
  providerUnavailable,
} from "./types";

/** Models that accept server-side refusal fallback (`fallbacks: "default"`). */
const SERVER_FALLBACK_MODELS = new Set([
  "claude-fable-5-1",
  "claude-opus-5-5",
  "claude-opus-5",
  "claude-sonnet-5-5",
]);
/** Adaptive thinking may run before the answer; leave it room within max_tokens. */
const THINKING_HEADROOM = 4096;
/** Non-streaming ceiling that keeps responses inside HTTP timeouts. */
const MAX_TOKENS_CEILING = 16000;

const usageOf = (u: Anthropic.Usage): Usage => {
  const cacheRead = u.cache_read_input_tokens ?? 0,
    cacheWrite = u.cache_creation_input_tokens ?? 0;
  return {
    inputTokens: u.input_tokens + cacheRead + cacheWrite,
    cachedInputTokens: cacheRead,
    cacheWriteTokens: cacheWrite,
    outputTokens: u.output_tokens,
    reasoningTokens: u.output_tokens_details?.thinking_tokens ?? 0,
  };
};

/**
 * Claude Messages API via the official SDK. Structured output uses
 * `output_config.format` (forced tool use is rejected by current models).
 * The system prompt and workspace context carry cache breakpoints.
 */
export function createAnthropicProvider(
  apiKey: string,
  options: { serverFallback?: boolean; fetch?: typeof fetch } = {},
): ModelProvider {
  const client = new Anthropic({
    apiKey,
    // The router decides about retries and cross-provider fallback.
    maxRetries: 0,
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  return {
    id: "anthropic",
    async generate(request) {
      const { parts } = request;
      const body: Anthropic.MessageCreateParamsNonStreaming = {
        model: request.model,
        max_tokens: Math.min(
          MAX_TOKENS_CEILING,
          request.maxOutputTokens + THINKING_HEADROOM,
        ),
        system: [
          {
            type: "text",
            text: parts.system,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              ...(parts.context
                ? [
                    {
                      type: "text" as const,
                      text: parts.context,
                      cache_control: { type: "ephemeral" as const },
                    },
                  ]
                : []),
              { type: "text" as const, text: parts.task },
            ],
          },
        ],
        output_config: {
          format: { type: "json_schema", schema: request.schema },
          ...(request.effort ? { effort: request.effort } : {}),
        },
      };
      let message: Anthropic.Message | Anthropic.Beta.BetaMessage;
      try {
        message =
          options.serverFallback !== false &&
          SERVER_FALLBACK_MODELS.has(request.model)
            ? await client.beta.messages.create(
                {
                  ...(body as Anthropic.Beta.MessageCreateParamsNonStreaming),
                  betas: ["server-side-fallback-2026-07-01"],
                  fallbacks: "default",
                },
                { signal: request.signal },
              )
            : await client.messages.create(body, { signal: request.signal });
      } catch (e) {
        if (e instanceof Anthropic.APIConnectionTimeoutError || isAbort(e))
          throw providerTimeout();
        if (e instanceof Anthropic.APIUserAbortError) throw providerTimeout();
        if (e instanceof Anthropic.APIError && typeof e.status === "number")
          throw providerHttpError(e.status);
        throw providerUnavailable();
      }
      const usage = usageOf(message.usage as Anthropic.Usage);
      if (message.stop_reason === "refusal") throw filtered(usage);
      if (message.stop_reason === "max_tokens") throw outputLimit(usage);
      const text = message.content
        .map((block) => (block.type === "text" ? block.text : ""))
        .join("");
      try {
        return { output: JSON.parse(text), usage, model: message.model };
      } catch {
        throw invalidOutput(usage);
      }
    },
  };
}
