import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
  unique,
} from "drizzle-orm/sqlite-core";
// Source of truth for drizzle-kit migrations. FTS5 virtual tables and their
// triggers cannot be expressed here; they live in hand-written SQL appended to
// the generated migration (see drizzle/0001_*.sql).
export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id").notNull(),
    createdAt: text("created_at").notNull(),
    /** JSON: { policy, profile } validated by lib/domain/settings.ts. */
    settings: text("settings").notNull().default("{}"),
    settingsRevision: integer("settings_revision").notNull().default(0),
    /** Soft deletion: hidden immediately, purged after the retention grace period. */
    deletedAt: text("deleted_at"),
  },
  (t) => [index("workspace_owner").on(t.ownerId)],
);
export const memberships = sqliteTable(
  "memberships",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    userId: text("user_id").notNull(),
    role: text("role", { enum: ["owner", "editor", "viewer"] }).notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.userId] }),
    index("member_user").on(t.userId),
  ],
);
export const productions = sqliteTable(
  "productions",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    id: text("id").notNull(),
    revision: integer("revision").notNull(),
    data: text("data").notNull(),
    lastCommand: text("last_command").notNull(),
    updatedAt: text("updated_at").notNull(),
    // Denormalized summary columns so lists never parse the JSON aggregate.
    title: text("title").notNull().default(""),
    plannedDate: text("planned_date").notNull().default(""),
    itemCount: integer("item_count").notNull().default(0),
    sizeBytes: integer("size_bytes").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.id] }),
    index("production_updated").on(t.workspaceId, t.updatedAt),
  ],
);
export const revisions = sqliteTable(
  "revisions",
  {
    workspaceId: text("workspace_id").notNull(),
    productionId: text("production_id").notNull(),
    revision: integer("revision").notNull(),
    data: text("data").notNull(),
    actorId: text("actor_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.productionId, t.revision] })],
);
export const commands = sqliteTable(
  "commands",
  {
    workspaceId: text("workspace_id").notNull(),
    key: text("key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    /** JSON reference { productionId, revision }; the snapshot lives in revisions. */
    result: text("result").notNull(),
    createdAt: text("created_at").notNull().default("1970-01-01T00:00:00.000Z"),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.key] }),
    index("command_created").on(t.createdAt),
  ],
);
export const sources = sqliteTable(
  "sources",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    name: text("name").notNull(),
    kind: text("kind").notNull(),
    reference: text("reference").notNull(),
    body: text("body").notNull(),
    hash: text("hash").notNull(),
    createdAt: text("created_at").notNull(),
    chars: integer("chars").notNull().default(0),
    preview: text("preview").notNull().default(""),
    aiExcluded: integer("ai_excluded").notNull().default(0),
    /** NULL until the source has been split into retrieval chunks. */
    chunkCount: integer("chunk_count"),
  },
  (t) => [index("source_workspace").on(t.workspaceId, t.createdAt)],
);
export const sourceChunks = sqliteTable(
  "source_chunks",
  {
    id: integer("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    sourceId: text("source_id").notNull(),
    ordinal: integer("ordinal").notNull(),
    body: text("body").notNull(),
  },
  (t) => [
    unique("source_chunk_ordinal").on(t.sourceId, t.ordinal),
    index("source_chunks_ws").on(t.workspaceId, t.sourceId),
  ],
);
export const searchDocs = sqliteTable(
  "search_docs",
  {
    id: integer("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    productionId: text("production_id").notNull(),
    itemId: text("item_id"),
    body: text("body").notNull(),
  },
  (t) => [index("search_docs_ws").on(t.workspaceId, t.productionId)],
);
export const changes = sqliteTable(
  "changes",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id),
    productionId: text("production_id").notNull(),
    data: text("data").notNull(),
    createdAt: text("created_at").notNull(),
    status: text("status", {
      enum: ["proposed", "applied", "rejected", "stale"],
    })
      .notNull()
      .default("proposed"),
    itemId: text("item_id"),
    beforeHash: text("before_hash"),
    originKind: text("origin_kind").notNull().default("server_ai"),
    clientId: text("client_id"),
    runId: text("run_id"),
    decidedBy: text("decided_by"),
    decidedAt: text("decided_at"),
    appliedRevision: integer("applied_revision"),
  },
  (t) => [
    index("change_workspace").on(t.workspaceId, t.productionId, t.createdAt),
    index("change_status").on(t.workspaceId, t.status, t.createdAt),
  ],
);
export const generationRequests = sqliteTable(
  "generation_requests",
  {
    workspaceId: text("workspace_id").notNull(),
    key: text("key").notNull(),
    fingerprint: text("fingerprint").notNull(),
    status: text("status").notNull(),
    changeId: text("change_id"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.workspaceId, t.key] }),
    index("generation_ws_created").on(t.workspaceId, t.createdAt),
  ],
);
/** One row per provider attempt. Holds no prompt or output text. */
export const aiRuns = sqliteTable(
  "ai_runs",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id").notNull(),
    actorId: text("actor_id").notNull(),
    channel: text("channel").notNull(),
    clientId: text("client_id"),
    task: text("task").notNull(),
    taskVersion: text("task_version").notNull(),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    attempt: integer("attempt").notNull().default(1),
    status: text("status").notNull(),
    inputTokens: integer("input_tokens"),
    cachedInputTokens: integer("cached_input_tokens"),
    outputTokens: integer("output_tokens"),
    reasoningTokens: integer("reasoning_tokens"),
    costMicros: integer("cost_micros"),
    latencyMs: integer("latency_ms"),
    errorCode: text("error_code"),
    redactions: integer("redactions").notNull().default(0),
    contextHash: text("context_hash"),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("ai_runs_ws_created").on(t.workspaceId, t.createdAt),
    index("ai_runs_actor_created").on(t.actorId, t.createdAt),
  ],
);
/** Mutations and denied requests. Holds identifiers only, never content. */
export const auditEvents = sqliteTable(
  "audit_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id"),
    actorId: text("actor_id").notNull(),
    channel: text("channel").notNull(),
    clientId: text("client_id"),
    operation: text("operation").notNull(),
    targetId: text("target_id"),
    outcome: text("outcome").notNull(),
    errorCode: text("error_code"),
    requestId: text("request_id").notNull(),
    createdAt: text("created_at").notNull(),
  },
  (t) => [
    index("audit_ws_created").on(t.workspaceId, t.createdAt),
    index("audit_created").on(t.createdAt),
  ],
);
