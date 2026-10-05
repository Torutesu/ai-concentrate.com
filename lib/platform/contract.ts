/**
 * Shapes both platform modules (runtime.ts for Vercel, sites.ts for the
 * private Sites gateway) must provide. Vite swaps the modules by alias, so
 * these types are the compatibility contract between them.
 */
export type Identity = {
  userId: string;
  /** True for OAuth access tokens held by external agents (MCP/CLI). */
  agent: boolean;
  clientId: string | null;
  tokenScopes: readonly string[] | null;
};
/** RFC 9728 OAuth Protected Resource Metadata for the MCP endpoint. */
export type ProtectedResourceMetadata = {
  resource: string;
  authorization_servers: string[];
  bearer_methods_supported: string[];
  scopes_supported: string[];
  resource_name: string;
};
