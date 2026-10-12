// Default runtime is independent Next.js on Vercel. Vite aliases this module to
// sites.ts; both must export the same names (see lib/platform/contract.ts).
import { createClient } from "@libsql/client";
import { auth, clerkClient, currentUser } from "@clerk/nextjs/server";
import { accessRules, decidedById, isAllowed } from "../server/access";
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
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  return {
    userId,
    email,
    displayName: user.fullName ?? user.username ?? "Member",
    allowed: isAllowed(accessRules(process.env), { userId, email }),
  };
}
const emailCache = new Map<string, { email: string; until: number }>();
/** Primary email for an allowlist decision, cached per instance for 5 minutes. */
async function emailOf(userId: string) {
  const hit = emailCache.get(userId);
  if (hit && hit.until > Date.now()) return hit.email;
  const user = await (await clerkClient()).users.getUser(userId);
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  if (emailCache.size > 1000) emailCache.clear();
  emailCache.set(userId, { email, until: Date.now() + 300_000 });
  return email;
}
/**
 * Verified caller for API/MCP requests. Session tokens are verified locally
 * (no Backend API call per request); OAuth access tokens identify external
 * agents and their client and are accepted only once MCP OAuth is enabled.
 * Identity headers from requests are never trusted. Accounts outside the
 * deployment's allowlist are refused (see lib/server/access.ts).
 */
export async function getIdentity(_request: Request): Promise<Identity | null> {
  if (!authConfigured()) return null;
  const a = await auth({
    acceptsToken: mcpAvailable()
      ? ["session_token", "oauth_token"]
      : ["session_token"],
  });
  if (!a.isAuthenticated) return null;
  const rules = accessRules(process.env);
  const allowed = decidedById(rules, a.userId)
    ? isAllowed(rules, { userId: a.userId })
    : isAllowed(rules, { userId: a.userId, email: await emailOf(a.userId) });
  if (!allowed)
    throw new DomainError(
      "ACCESS_DENIED",
      403,
      "This account is not allowed to use this deployment.",
    );
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
