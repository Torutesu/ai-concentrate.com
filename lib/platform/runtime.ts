// Default runtime is independent Next.js on Vercel. Vite aliases this module to
// sites.ts; both must export the same names (see lib/platform/contract.ts).
import { createClient } from "@libsql/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { LibsqlDatabase } from "./libsql";
import { DomainError } from "../domain/models";
import type { AiEnv } from "../ai/config";
import type { Identity, ProtectedResourceMetadata } from "./contract";

export function authConfigured() {
  return Boolean(
    process.env.CLERK_SECRET_KEY &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
}
/** Profile for server-rendered pages only. Calls the Clerk Backend API. */
export async function getUser() {
  if (!authConfigured()) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  if (!user) return null;
  return {
    userId,
    email: user.primaryEmailAddress?.emailAddress ?? "",
    displayName: user.fullName ?? user.username ?? "Member",
  };
}
/**
 * Verified caller for API/MCP requests. Session tokens are verified locally
 * (no Backend API call per request); OAuth access tokens identify external
 * agents and their client. Identity headers from requests are never trusted.
 */
export async function getIdentity(_request: Request): Promise<Identity | null> {
  if (!authConfigured()) return null;
  const a = await auth({ acceptsToken: ["session_token", "oauth_token"] });
  if (!a.isAuthenticated) return null;
  if (a.tokenType === "oauth_token")
    return {
      userId: a.userId,
      agent: true,
      clientId: a.clientId,
      tokenScopes: a.scopes,
    };
  return { userId: a.userId, agent: false, clientId: null, tokenScopes: null };
}
let db: LibsqlDatabase | undefined;
export function database() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)
    throw new DomainError(
      "STORAGE_UNAVAILABLE",
      503,
      "Database is not configured.",
    );
  return (db ??= new LibsqlDatabase(
    createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  ));
}
export const aiEnv = (): AiEnv => process.env as AiEnv;
/** MCP OAuth is advertised only after Clerk OAuth applications are enabled. */
export const mcpAvailable = () =>
  authConfigured() && process.env.MCP_OAUTH_ENABLED === "true";
export function protectedResourceMetadata(
  origin: string,
): ProtectedResourceMetadata | null {
  if (!mcpAvailable()) return null;
  const issuer =
    process.env.MCP_AUTHORIZATION_SERVER ??
    clerkFrontendApi(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? "");
  if (!issuer) return null;
  return {
    resource: `${origin}/mcp`,
    authorization_servers: [issuer],
    bearer_methods_supported: ["header"],
    scopes_supported: ["profile", "email"],
    resource_name: "AI Concentrate",
  };
}
/** pk_(test|live)_<base64("frontend-api-host$")> → https://frontend-api-host */
export function clerkFrontendApi(publishableKey: string) {
  const encoded = publishableKey.match(/^pk_(?:test|live)_(.+)$/)?.[1];
  if (!encoded) return null;
  try {
    const host = atob(encoded).replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}
export const cronSecret = () => process.env.CRON_SECRET;
export const clerkWebhookSecret = () => process.env.CLERK_WEBHOOK_SECRET;
export const signInPath = () => "/sign-in";
export const signInLabel = "ログイン / アカウント作成";
