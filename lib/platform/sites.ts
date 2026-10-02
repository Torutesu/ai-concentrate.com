import { env } from "cloudflare:workers";
import { getChatGPTUser, chatGPTSignInPath } from "../../app/chatgpt-auth";
import { DomainError } from "../domain/models";
import type { Database } from "./database";
export const getUser = getChatGPTUser;
export const authConfigured = () => true;
export const signInPath = () => chatGPTSignInPath("/");
export const signInLabel = "ChatGPTで続ける";
export function database(): Database {
  if (!env.DB)
    throw new DomainError(
      "STORAGE_UNAVAILABLE",
      503,
      "Database is not configured.",
    );
  // D1 and libSQL expose different statement types but the same repository contract.
  return env.DB as unknown as Database;
}
export function aiConfig() {
  return env as unknown as { OPENAI_API_KEY?: string; OPENAI_MODEL?: string };
}
