import {
  sqliteTable,
  text,
  integer,
  primaryKey,
  index,
} from "drizzle-orm/sqlite-core";
export const workspaces = sqliteTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    ownerId: text("owner_id").notNull(),
    createdAt: text("created_at").notNull(),
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
    result: text("result").notNull(),
  },
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
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
  },
  (t) => [index("source_workspace").on(t.workspaceId, t.createdAt)],
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
  },
  (t) => [
    index("change_workspace").on(t.workspaceId, t.productionId, t.createdAt),
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
  (t) => [primaryKey({ columns: [t.workspaceId, t.key] })],
);
