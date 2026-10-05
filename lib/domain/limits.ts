/**
 * Size and quota limits shared by every transport. Byte limits are UTF-8 bytes:
 * Japanese text is ~3 bytes per character, so character limits alone let the
 * stored aggregate exceed what the HTTP layer and D1 rows accept.
 */
export const LIMITS = {
  /** One content item's body. */
  itemBodyBytes: 48_000,
  /** JSON-serialized production aggregate (brief + all items). */
  aggregateBytes: 256_000,
  items: 100,
  /** HTTP/MCP request body; must exceed aggregateBytes plus envelope. */
  requestBytes: 300_000,
  sourceChars: 60_000,
  sourcesPerWorkspace: 200,
  workspacesPerOwner: 20,
  /** Default size of one MCP/API list page. */
  pageSize: 20,
  maxPageSize: 50,
  /** Characters returned by one context_get / item_get call by default. */
  readChars: 8_000,
  previewChars: 600,
} as const;

/** Retention windows in days. Workspaces are purged after the grace period. */
export const RETENTION = {
  commandDays: 7,
  generationRequestDays: 30,
  decidedChangeDays: 90,
  workspaceGraceDays: 30,
  ledgerDays: 400,
} as const;
