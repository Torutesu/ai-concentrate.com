import { env } from "cloudflare:workers";
import { getChatGPTUser, chatGPTSignInPath } from "../../app/chatgpt-auth";
import { DomainError } from "../domain/models";
import type { AiEnv } from "../ai/config";
import type { Database } from "./database";
import type { Identity, ProtectedResourceMetadata } from "./contract";

// Private Sites runtime: the gateway authenticates every request (including
// MCP OAuth) and supplies identity headers. Never expose this Worker directly.
export const getUser = getChatGPTUser;
export const authConfigured = () => true;
export async function getIdentity(request: Request): Promise<Identity | null> {
  const user = await getChatGPTUser();
  if (!user) return null;
  // The gateway terminates OAuth for /mcp; treat those calls as an agent.
  const agent = new URL(request.url).pathname === "/mcp";
  return { userId: user.userId, agent, clientId: null, tokenScopes: null };
}
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
export const aiEnv = () => env as unknown as AiEnv;
export const mcpAvailable = () => true;
/** The Sites gateway publishes its own OAuth metadata. */
export const protectedResourceMetadata = (
  _origin: string,
): ProtectedResourceMetadata | null => null;
export const cronSecret = () =>
  (env as unknown as { CRON_SECRET?: string }).CRON_SECRET;
export const clerkWebhookSecret = (): string | undefined => undefined;
