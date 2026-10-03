import { aiConfig } from "@/lib/platform/runtime";
import { DomainError } from "../domain/models";
import { createOpenAIProvider } from "./openai-provider";
export const aiConfigured = () =>
  Boolean(aiConfig().OPENAI_API_KEY && aiConfig().OPENAI_MODEL);
export function aiProvider() {
  const { OPENAI_API_KEY, OPENAI_MODEL } = aiConfig();
  if (!OPENAI_API_KEY || !OPENAI_MODEL)
    throw new DomainError(
      "AI_NOT_CONFIGURED",
      503,
      "AI generation requires server-side provider configuration.",
    );
  return createOpenAIProvider({ OPENAI_API_KEY, OPENAI_MODEL });
}
