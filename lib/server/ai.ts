import { generationInstructions } from "../agents/marketing";
import { aiConfig } from "@/lib/platform/runtime";
import { z } from "zod";
import { DomainError } from "../domain/models";
import type { GenerationProvider } from "./service";
const config = aiConfig;
export const aiConfigured = () =>
  Boolean(config().OPENAI_API_KEY && config().OPENAI_MODEL);
export function aiProvider(): GenerationProvider {
  if (!aiConfigured())
    throw new DomainError(
      "AI_NOT_CONFIGURED",
      503,
      "AI generation requires server-side provider configuration.",
    );
  return {
    async revise(input) {
      const r = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config().OPENAI_API_KEY}`,
        },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model: config().OPENAI_MODEL,
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
      if (!r.ok)
        throw new DomainError(
          "PROVIDER_ERROR",
          502,
          "The AI provider could not complete the request.",
        );
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
