export const SCOPES = [
  "studio:read",
  "studio:write",
  "studio:propose",
  "studio:ai",
  "studio:apply",
  "studio:delete",
  "studio:admin",
] as const;
export type Scope = (typeof SCOPES)[number];
export type Channel = "web" | "mcp" | "system";

/** Verified caller. Never built from request bodies. */
export type Actor = {
  userId: string;
  channel: Channel;
  /** OAuth client for agent tokens; null for browser sessions. */
  clientId: string | null;
  scopes: readonly Scope[];
  requestId: string;
};

/** People in the app may do anything their workspace role allows. */
export const HUMAN_SCOPES: readonly Scope[] = SCOPES;
/**
 * External agents read, edit drafts, propose and run server AI. Applying
 * proposals, deleting and administration stay with people unless the
 * workspace policy allows agent application (see AiPolicy.agentApply).
 */
export const AGENT_SCOPES: readonly Scope[] = [
  "studio:read",
  "studio:write",
  "studio:propose",
  "studio:ai",
];

/** Token scopes narrow agent defaults; unrelated provider scopes are ignored. */
export function agentScopes(tokenScopes: readonly string[] | null | undefined) {
  const requested = (tokenScopes ?? []).filter((s): s is Scope =>
    (SCOPES as readonly string[]).includes(s),
  );
  return requested.length ? requested : AGENT_SCOPES;
}
