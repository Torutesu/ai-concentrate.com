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

type ResponsesBody = {
  status?: string;
  model?: string;
  incomplete_details?: { reason?: string } | null;
  output?: { content?: { type: string; text?: string }[] }[];
  usage?: {
    input_tokens?: number;
    input_tokens_details?: { cached_tokens?: number };
    output_tokens?: number;
    output_tokens_details?: { reasoning_tokens?: number };
  };
};

const usageOf = (u: ResponsesBody["usage"]): Usage => ({
  inputTokens: u?.input_tokens ?? 0,
  cachedInputTokens: u?.input_tokens_details?.cached_tokens ?? 0,
  cacheWriteTokens: 0,
  outputTokens: u?.output_tokens ?? 0,
  reasoningTokens: u?.output_tokens_details?.reasoning_tokens ?? 0,
});

/**
 * OpenAI Responses API. Stable prompt parts come first and share a
 * `prompt_cache_key` so repeated edits in a workspace reuse the cached prefix.
 * `store: false`: responses are not retained for later retrieval.
 */
export function createOpenAIProvider(
  apiKey: string,
  transport: typeof fetch = fetch,
): ModelProvider {
  return {
    id: "openai",
    async generate(request) {
      const { parts } = request;
      let r: Response;
      try {
        r = await transport("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          signal: request.signal,
          body: JSON.stringify({
            model: request.model,
            store: false,
            instructions: parts.system,
            input: [
              ...(parts.context
                ? [
                    {
                      role: "user",
                      content: [{ type: "input_text", text: parts.context }],
                    },
                  ]
                : []),
              {
                role: "user",
                content: [{ type: "input_text", text: parts.task }],
              },
            ],
            max_output_tokens: request.maxOutputTokens,
            prompt_cache_key: request.cacheKey,
            ...(request.effort
              ? { reasoning: { effort: request.effort } }
              : {}),
            text: {
              format: {
                type: "json_schema",
                name: request.schemaName,
                strict: true,
                schema: request.schema,
              },
            },
          }),
        });
      } catch (e) {
        throw isAbort(e) ? providerTimeout() : providerUnavailable();
      }
      // Never expose raw provider errors: they may contain credentials or input.
      if (!r.ok) throw providerHttpError(r.status);
      let data: ResponsesBody;
      try {
        data = (await r.json()) as ResponsesBody;
      } catch {
        throw invalidOutput();
      }
      const usage = usageOf(data.usage);
      if (data.status === "incomplete") {
        if (data.incomplete_details?.reason === "content_filter")
          throw filtered(usage);
        throw outputLimit(usage);
      }
      if (data.status !== "completed") throw invalidOutput(usage);
      const content = data.output?.flatMap((o) => o.content ?? []) ?? [];
      if (content.some((c) => c.type === "refusal")) throw filtered(usage);
      const text = content
        .filter((c) => c.type === "output_text")
        .map((c) => c.text ?? "")
        .join("");
      try {
        return {
          output: JSON.parse(text),
          usage,
          model: data.model ?? request.model,
        };
      } catch {
        throw invalidOutput(usage);
      }
    },
  };
}
