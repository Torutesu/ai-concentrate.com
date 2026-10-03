import { generationInstructions } from "../agents/marketing";
import { z } from "zod";
import { DomainError } from "../domain/models";
import type { GenerationProvider } from "./service";
export function createOpenAIProvider(
  settings: { OPENAI_API_KEY: string; OPENAI_MODEL: string },
  transport: typeof fetch = fetch,
): GenerationProvider {
  return {
    async revise(input) {
      let r: Response;
      try {
        r = await transport("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${settings.OPENAI_API_KEY}`,
          },
          signal: AbortSignal.timeout(45000),
          body: JSON.stringify({
            model: settings.OPENAI_MODEL,
            store: false,
            max_output_tokens: 3500,
            instructions: generationInstructions(input.kind),
            input: JSON.stringify(input),
            text: {
              format: {
                type: "json_schema",
                name: "revision",
                strict: true,
                schema: {
                  type: "object",
                  properties: { body: { type: "string" } },
                  required: ["body"],
                  additionalProperties: false,
                },
              },
            },
          }),
        });
      } catch (e) {
        const timeout =
          e instanceof Error &&
          (e.name === "TimeoutError" || e.name === "AbortError");
        throw new DomainError(
          timeout ? "PROVIDER_TIMEOUT" : "PROVIDER_UNAVAILABLE",
          timeout ? 504 : 503,
          timeout
            ? "Generation timed out. Your saved draft is unchanged."
            : "AI provider is unreachable. Try again later.",
        );
      }
      // Never expose raw provider errors: they may contain credentials or input.
      if (!r.ok) {
        if (r.status === 401 || r.status === 403)
          throw new DomainError(
            "PROVIDER_AUTH",
            503,
            "AI credentials or model access need administrator attention.",
          );
        if (r.status === 429)
          throw new DomainError(
            "PROVIDER_CAPACITY",
            429,
            "AI provider quota or rate limit reached. Check billing or try again later.",
          );
        throw new DomainError(
          "PROVIDER_ERROR",
          502,
          "The AI provider could not complete the request.",
        );
      }
      const data = (await r.json()) as {
        status?: string;
        output?: { content?: { type: string; text?: string }[] }[];
      };
      if (data.status !== "completed")
        throw new DomainError("INCOMPLETE", 502, "Generation was incomplete.");
      const text = data.output
        ?.flatMap((o) => o.content ?? [])
        .filter((c) => c.type === "output_text")
        .map((c) => c.text ?? "")
        .join("");
      try {
        return z
          .object({ body: z.string().min(1).max(20000) })
          .strict()
          .parse(JSON.parse(text ?? "")).body;
      } catch {
        throw new DomainError(
          "INVALID_OUTPUT",
          502,
          "The generated content failed validation.",
        );
      }
    },
  };
}
