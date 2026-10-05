import type { Database, Statement } from "../platform/database";
import {
  DomainError,
  parseStoredProduction,
  type Change,
  type ChangeStatus,
  type ChangeSummary,
  type Production,
  type ProductionSummary,
  type Role,
  type Source,
  type SourceSummary,
  type VersionedProduction,
  type Workspace,
} from "../domain/models";
import { LIMITS, RETENTION } from "../domain/limits";
import { parseSettings, type WorkspaceSettings } from "../domain/settings";
import { utf8Bytes } from "../domain/hash";
import type { ContextStore, RetrievedChunk } from "../ai/context";

const now = () => new Date().toISOString();
const daysAgo = (days: number, from = Date.now()) =>
  new Date(from - days * 86_400_000).toISOString();

/** Opaque keyset cursor: [sortKey, id]. Never trusted beyond its shape. */
function decodeCursor(cursor?: string): [string, string] {
  if (!cursor) return ["", ""];
  try {
    const parts = JSON.parse(atob(cursor));
    if (
      Array.isArray(parts) &&
      parts.length === 2 &&
      parts.every((v) => typeof v === "string")
    )
      return parts as [string, string];
  } catch {}
  throw new DomainError("CURSOR", 400, "Invalid cursor.");
}
const encodeCursor = (key: string, id: string) =>
  btoa(JSON.stringify([key, id]));

/** Trigram FTS needs 3+ characters; quoting makes the input a literal phrase. */
export const ftsPhrase = (text: string) => `"${text.replaceAll('"', '""')}"`;

export type RunRecord = {
  id: string;
  workspaceId: string;
  actorId: string;
  channel: string;
  clientId: string | null;
  task: string;
  taskVersion: string;
  provider: string;
  model: string;
  attempt: number;
  status: "succeeded" | "failed";
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
  reasoningTokens: number | null;
  costMicros: number | null;
  latencyMs: number;
  errorCode: string | null;
  redactions: number;
  contextHash: string | null;
};
export type AuditRecord = {
  workspaceId: string | null;
  actorId: string;
  channel: string;
  clientId: string | null;
  operation: string;
  targetId: string | null;
  outcome: "succeeded" | "denied" | "failed";
  errorCode: string | null;
  requestId: string;
};

type ChangeRow = {
  data: string;
  status: ChangeStatus;
  before_hash: string | null;
  origin_kind: string;
  decided_by: string | null;
  decided_at: string | null;
  applied_revision: number | null;
};
function decodeChange(r: ChangeRow): Change {
  const data = JSON.parse(r.data) as Change;
  return {
    ...data,
    beforeHash: r.before_hash ?? data.beforeHash,
    warnings: data.warnings ?? [],
    status: r.status,
    decidedBy: r.decided_by ?? undefined,
    decidedAt: r.decided_at ?? undefined,
    appliedRevision: r.applied_revision ?? undefined,
  };
}
const CHANGE_COLUMNS =
  "data,status,before_hash,origin_kind,decided_by,decided_at,applied_revision";

type ProductionRow = {
  id: string;
  workspace_id: string;
  revision: number;
  data: string;
  updated_at: string;
};
const decodeProduction = (r: ProductionRow): VersionedProduction => ({
  id: r.id,
  workspaceId: r.workspace_id,
  revision: r.revision,
  data: parseStoredProduction(r.data),
  updatedAt: r.updated_at,
});

/** Desired search rows for a production, read from the row just written. */
const WANTED_SEARCH_ROWS = `WITH wanted(item_id, body) AS (
  SELECT NULL, json_extract(p.data,'$.title') FROM productions p
   WHERE p.workspace_id=?1 AND p.id=?2 AND p.revision=?3 AND p.last_command=?4
  UNION ALL
  SELECT json_extract(i.value,'$.id'), json_extract(i.value,'$.title') || char(10) || json_extract(i.value,'$.body')
    FROM productions p, json_each(p.data,'$.items') i
   WHERE p.workspace_id=?1 AND p.id=?2 AND p.revision=?3 AND p.last_command=?4)`;

export type SaveInput = {
  workspaceId: string;
  id: string;
  data: Production;
  base: number;
  key: string;
  fingerprint: string;
  actorId: string;
  /** `${itemId}:${sha256(body)}` for every unlocked item of `data`. */
  itemHashes: string[];
  /** Marks this proposal applied in the same transaction. */
  appliedChangeId?: string;
};

export class Repository implements ContextStore {
  constructor(private db: Database) {}

  // ---------------------------------------------------------------- workspaces
  async role(workspaceId: string, userId: string): Promise<Role> {
    const row = await this.db
      .prepare(
        "SELECT m.role FROM memberships m JOIN workspaces w ON w.id=m.workspace_id WHERE m.workspace_id=? AND m.user_id=? AND w.deleted_at IS NULL",
      )
      .bind(workspaceId, userId)
      .first<{ role: Role }>();
    if (!row) throw new DomainError("NOT_FOUND", 404, "Workspace not found.");
    return row.role;
  }
  async list(userId: string): Promise<Workspace[]> {
    return (
      await this.db
        .prepare(
          "SELECT w.id,w.name,m.role FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=? AND w.deleted_at IS NULL ORDER BY w.created_at,w.id LIMIT 100",
        )
        .bind(userId)
        .all<Workspace>()
    ).results;
  }
  /** Idempotent for the same ID; atomically enforces the per-owner quota. */
  async create(userId: string, name: string, id: string): Promise<Workspace> {
    await this.db.batch([
      this.db
        .prepare(
          `INSERT OR IGNORE INTO workspaces(id,name,owner_id,created_at)
           SELECT ?,?,?,? WHERE (SELECT COUNT(*) FROM workspaces WHERE owner_id=? AND deleted_at IS NULL) < ?`,
        )
        .bind(id, name, userId, now(), userId, LIMITS.workspacesPerOwner),
      this.db
        .prepare(
          "INSERT OR IGNORE INTO memberships(workspace_id,user_id,role) SELECT id,owner_id,'owner' FROM workspaces WHERE id=? AND owner_id=?",
        )
        .bind(id, userId),
    ]);
    const row = await this.db
      .prepare(
        "SELECT w.name,m.role FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE w.id=? AND m.user_id=? AND w.deleted_at IS NULL",
      )
      .bind(id, userId)
      .first<{ name: string; role: Role }>();
    if (row) return { id, name: row.name, role: row.role };
    const taken = await this.db
      .prepare("SELECT 1 AS x FROM workspaces WHERE id=?")
      .bind(id)
      .first();
    if (taken) throw new DomainError("NOT_FOUND", 404, "Workspace not found.");
    throw new DomainError(
      "WORKSPACE_LIMIT",
      429,
      `You can own at most ${LIMITS.workspacesPerOwner} workspaces.`,
    );
  }
  async settings(
    workspaceId: string,
  ): Promise<{ settings: WorkspaceSettings; revision: number }> {
    const row = await this.db
      .prepare(
        "SELECT settings,settings_revision FROM workspaces WHERE id=? AND deleted_at IS NULL",
      )
      .bind(workspaceId)
      .first<{ settings: string; settings_revision: number }>();
    if (!row) throw new DomainError("NOT_FOUND", 404, "Workspace not found.");
    return {
      settings: parseSettings(row.settings),
      revision: row.settings_revision,
    };
  }
  async updateSettings(
    workspaceId: string,
    settings: WorkspaceSettings,
    baseRevision: number,
  ) {
    const r = await this.db
      .prepare(
        "UPDATE workspaces SET settings=?,settings_revision=settings_revision+1 WHERE id=? AND settings_revision=? AND deleted_at IS NULL",
      )
      .bind(JSON.stringify(settings), workspaceId, baseRevision)
      .run();
    if (!r.meta.changes)
      throw new DomainError("CONFLICT", 409, "Settings changed. Reload first.");
    return { settings, revision: baseRevision + 1 };
  }
  async softDeleteWorkspace(workspaceId: string) {
    await this.db
      .prepare(
        "UPDATE workspaces SET deleted_at=? WHERE id=? AND deleted_at IS NULL",
      )
      .bind(now(), workspaceId)
      .run();
  }

  // --------------------------------------------------------------- productions
  async get(workspaceId: string, id: string) {
    const row = await this.db
      .prepare(
        "SELECT id,workspace_id,revision,data,updated_at FROM productions WHERE workspace_id=? AND id=?",
      )
      .bind(workspaceId, id)
      .first<ProductionRow>();
    return row ? decodeProduction(row) : null;
  }
  async receipt(
    workspaceId: string,
    key: string,
    fingerprint: string,
  ): Promise<VersionedProduction | null> {
    const r = await this.db
      .prepare(
        "SELECT fingerprint,result FROM commands WHERE workspace_id=? AND key=?",
      )
      .bind(workspaceId, key)
      .first<{ fingerprint: string; result: string }>();
    if (!r) return null;
    if (r.fingerprint !== fingerprint)
      throw new DomainError(
        "IDEMPOTENCY_MISMATCH",
        409,
        "This request key was used with different input.",
      );
    const ref = JSON.parse(r.result) as {
      productionId: string;
      revision: number;
    };
    const snapshot = await this.db
      .prepare(
        "SELECT data,created_at FROM revisions WHERE workspace_id=? AND production_id=? AND revision=?",
      )
      .bind(workspaceId, ref.productionId, ref.revision)
      .first<{ data: string; created_at: string }>();
    if (!snapshot)
      throw new DomainError("NOT_FOUND", 404, "Production not found.");
    return {
      id: ref.productionId,
      workspaceId,
      revision: ref.revision,
      data: parseStoredProduction(snapshot.data),
      updatedAt: snapshot.created_at,
    };
  }
  /**
   * One transaction: compare-and-swap the aggregate, append the immutable
   * snapshot, record the idempotency receipt, update only changed search rows,
   * mark proposals whose target text changed as stale and (optionally) mark the
   * applied proposal. Every dependent statement is guarded by the CAS result.
   */
  async save(input: SaveInput): Promise<VersionedProduction> {
    const { workspaceId, id, data, base, key, fingerprint, actorId } = input;
    const existing = await this.receipt(workspaceId, key, fingerprint);
    if (existing) return existing;
    const at = now(),
      json = JSON.stringify(data),
      next = base + 1;
    const summary = [
      data.title,
      data.plannedDate,
      data.items.length,
      utf8Bytes(json),
    ];
    const mutation =
      base === 0
        ? this.db
            .prepare(
              "INSERT OR IGNORE INTO productions(workspace_id,id,revision,data,last_command,updated_at,title,planned_date,item_count,size_bytes) VALUES(?,?,?,?,?,?,?,?,?,?)",
            )
            .bind(workspaceId, id, next, json, key, at, ...summary)
        : this.db
            .prepare(
              "UPDATE productions SET revision=?,data=?,last_command=?,updated_at=?,title=?,planned_date=?,item_count=?,size_bytes=? WHERE workspace_id=? AND id=? AND revision=?",
            )
            .bind(next, json, key, at, ...summary, workspaceId, id, base);
    const guard = [workspaceId, id, next, key] as const;
    const written =
      "EXISTS (SELECT 1 FROM productions WHERE workspace_id=?1 AND id=?2 AND revision=?3 AND last_command=?4)";
    const statements: Statement[] = [
      mutation,
      this.db
        .prepare(
          "INSERT OR IGNORE INTO revisions(workspace_id,production_id,revision,data,actor_id,created_at) SELECT workspace_id,id,revision,data,?5,updated_at FROM productions WHERE workspace_id=?1 AND id=?2 AND revision=?3 AND last_command=?4",
        )
        .bind(...guard, actorId),
      this.db
        .prepare(
          `INSERT INTO commands(workspace_id,key,fingerprint,result,created_at) SELECT ?1,?4,?5,?6,?7 WHERE ${written}`,
        )
        .bind(
          ...guard,
          fingerprint,
          JSON.stringify({ productionId: id, revision: next }),
          at,
        ),
      this.db
        .prepare(
          `${WANTED_SEARCH_ROWS} DELETE FROM search_docs WHERE workspace_id=?1 AND production_id=?2 AND EXISTS (SELECT 1 FROM wanted) AND NOT EXISTS (SELECT 1 FROM wanted w WHERE w.item_id IS search_docs.item_id AND w.body = search_docs.body)`,
        )
        .bind(...guard),
      this.db
        .prepare(
          `${WANTED_SEARCH_ROWS} INSERT INTO search_docs(workspace_id,production_id,item_id,body) SELECT ?1,?2,w.item_id,w.body FROM wanted w WHERE NOT EXISTS (SELECT 1 FROM search_docs d WHERE d.workspace_id=?1 AND d.production_id=?2 AND d.item_id IS w.item_id AND d.body = w.body)`,
        )
        .bind(...guard),
      this.db
        .prepare(
          `UPDATE changes SET status='stale' WHERE workspace_id=?1 AND production_id=?2 AND status='proposed' AND id IS NOT ?5 AND ${written}
             AND NOT EXISTS (SELECT 1 FROM json_each(?6) h WHERE h.value = changes.item_id || ':' || COALESCE(changes.before_hash,''))`,
        )
        .bind(
          ...guard,
          input.appliedChangeId ?? null,
          JSON.stringify(input.itemHashes),
        ),
    ];
    if (input.appliedChangeId)
      statements.push(
        this.db
          .prepare(
            `UPDATE changes SET status='applied',decided_by=?5,decided_at=?6,applied_revision=?3 WHERE workspace_id=?1 AND id=?7 AND status='proposed' AND ${written}`,
          )
          .bind(...guard, actorId, at, input.appliedChangeId),
      );
    try {
      await this.db.batch(statements);
    } catch (error) {
      const replay = await this.receipt(workspaceId, key, fingerprint);
      if (replay) return replay;
      throw error;
    }
    const receipt = await this.receipt(workspaceId, key, fingerprint);
    if (!receipt)
      throw new DomainError("CONFLICT", 409, "A newer revision exists.");
    return receipt;
  }
  async deleteProduction(workspaceId: string, id: string) {
    if (!(await this.get(workspaceId, id)))
      throw new DomainError("NOT_FOUND", 404, "Production not found.");
    await this.db.batch(
      ["search_docs", "changes", "revisions"]
        .map((table) =>
          this.db
            .prepare(
              `DELETE FROM ${table} WHERE workspace_id=? AND production_id=?`,
            )
            .bind(workspaceId, id),
        )
        .concat(
          this.db
            .prepare("DELETE FROM productions WHERE workspace_id=? AND id=?")
            .bind(workspaceId, id),
        ),
    );
  }
  async pageProductions(
    workspaceId: string,
    limit: number,
    cursor?: string,
    query = "",
  ): Promise<{ items: ProductionSummary[]; nextCursor: string | null }> {
    const [date, id] = decodeCursor(cursor);
    const q = query.trim();
    const filter = !q
      ? ""
      : [...q].length >= 3
        ? "AND p.id IN (SELECT d.production_id FROM search_fts JOIN search_docs d ON d.id=search_fts.rowid WHERE search_fts MATCH ? AND d.workspace_id=?)"
        : "AND p.id IN (SELECT production_id FROM search_docs WHERE workspace_id=? AND instr(lower(body),lower(?))>0)";
    const filterArgs = !q
      ? []
      : [...q].length >= 3
        ? [ftsPhrase(q), workspaceId]
        : [workspaceId, q];
    const rows = await this.db
      .prepare(
        `SELECT p.id,p.revision,p.updated_at,p.title,p.planned_date AS plannedDate,p.item_count AS itemCount
           FROM productions p WHERE p.workspace_id=? ${filter}
           AND (?='' OR p.updated_at<? OR (p.updated_at=? AND p.id<?))
           ORDER BY p.updated_at DESC,p.id DESC LIMIT ?`,
      )
      .bind(workspaceId, ...filterArgs, date, date, date, id, limit + 1)
      .all<{
        id: string;
        revision: number;
        updated_at: string;
        title: string;
        plannedDate: string;
        itemCount: number;
      }>();
    const items = rows.results.slice(0, limit),
      last = items.at(-1);
    return {
      items: items.map(({ updated_at, ...r }) => ({
        ...r,
        workspaceId,
        updatedAt: updated_at,
      })),
      nextCursor:
        rows.results.length > limit && last
          ? encodeCursor(last.updated_at, last.id)
          : null,
    };
  }
  async revision(workspaceId: string, id: string, revision: number) {
    const row = await this.db
      .prepare(
        "SELECT data FROM revisions WHERE workspace_id=? AND production_id=? AND revision=?",
      )
      .bind(workspaceId, id, revision)
      .first<{ data: string }>();
    if (!row) throw new DomainError("NOT_FOUND", 404, "Revision not found.");
    return parseStoredProduction(row.data);
  }
  async historyPage(
    workspaceId: string,
    id: string,
    limit: number,
    before?: number,
  ) {
    const rows = (
      await this.db
        .prepare(
          "SELECT revision,actor_id AS actorId,created_at AS createdAt FROM revisions WHERE workspace_id=? AND production_id=? AND (? IS NULL OR revision<?) ORDER BY revision DESC LIMIT ?",
        )
        .bind(workspaceId, id, before ?? null, before ?? null, limit + 1)
        .all<{ revision: number; actorId: string; createdAt: string }>()
    ).results;
    const items = rows.slice(0, limit);
    return {
      items,
      nextBefore: rows.length > limit ? items.at(-1)!.revision : null,
    };
  }

  // ------------------------------------------------------------------- sources
  async sourceSummaries(
    workspaceId: string,
    limit: number,
    cursor?: string,
  ): Promise<{ items: SourceSummary[]; nextCursor: string | null }> {
    const [created, id] = decodeCursor(cursor);
    const rows = (
      await this.db
        .prepare(
          `SELECT id,workspace_id AS workspaceId,name,kind,reference,hash,created_at AS createdAt,chars,preview,ai_excluded AS aiExcluded
             FROM sources WHERE workspace_id=? AND (?='' OR created_at<? OR (created_at=? AND id<?))
             ORDER BY created_at DESC,id DESC LIMIT ?`,
        )
        .bind(workspaceId, created, created, created, id, limit + 1)
        .all<
          Omit<SourceSummary, "truncated" | "aiExcluded"> & {
            aiExcluded: number;
          }
        >()
    ).results;
    const items = rows.slice(0, limit).map((r) => ({
      ...r,
      kind: r.kind as Source["kind"],
      aiExcluded: Boolean(r.aiExcluded),
      truncated: r.chars > r.preview.length,
    }));
    const last = items.at(-1);
    return {
      items,
      nextCursor:
        rows.length > limit && last
          ? encodeCursor(last.createdAt, last.id)
          : null,
    };
  }
  async sourceCount(workspaceId: string) {
    const r = await this.db
      .prepare("SELECT COUNT(*) AS n FROM sources WHERE workspace_id=?")
      .bind(workspaceId)
      .first<{ n: number }>();
    return r?.n ?? 0;
  }
  async source(
    workspaceId: string,
    id: string,
  ): Promise<Source & { aiExcluded: boolean }> {
    const r = await this.db
      .prepare(
        "SELECT id,workspace_id AS workspaceId,name,kind,reference,body,hash,created_at AS createdAt,ai_excluded AS aiExcluded FROM sources WHERE workspace_id=? AND id=?",
      )
      .bind(workspaceId, id)
      .first<Source & { aiExcluded: number }>();
    if (!r) throw new DomainError("NOT_FOUND", 404, "Source not found.");
    return { ...r, aiExcluded: Boolean(r.aiExcluded) };
  }
  /** Atomically enforces the per-workspace quota and stores retrieval chunks. */
  async addSource(source: Source, chunks: string[]) {
    await this.db.batch([
      this.db
        .prepare(
          `INSERT INTO sources(id,workspace_id,name,kind,reference,body,hash,created_at,chars,preview,chunk_count)
           SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE (SELECT COUNT(*) FROM sources WHERE workspace_id=?) < ?`,
        )
        .bind(
          source.id,
          source.workspaceId,
          source.name,
          source.kind,
          source.reference,
          source.body,
          source.hash,
          source.createdAt,
          source.body.length,
          source.body.slice(0, LIMITS.previewChars),
          chunks.length,
          source.workspaceId,
          LIMITS.sourcesPerWorkspace,
        ),
      this.insertChunks(source.workspaceId, source.id, chunks),
    ]);
    const stored = await this.db
      .prepare("SELECT 1 AS x FROM sources WHERE workspace_id=? AND id=?")
      .bind(source.workspaceId, source.id)
      .first();
    if (!stored)
      throw new DomainError(
        "SOURCE_LIMIT",
        429,
        `A workspace can hold at most ${LIMITS.sourcesPerWorkspace} sources. Delete unused ones first.`,
      );
    return source;
  }
  private insertChunks(
    workspaceId: string,
    sourceId: string,
    chunks: string[],
  ) {
    return this.db
      .prepare(
        "INSERT OR IGNORE INTO source_chunks(workspace_id,source_id,ordinal,body) SELECT ?1,?2,CAST(key AS INTEGER),value FROM json_each(?3) WHERE EXISTS (SELECT 1 FROM sources WHERE workspace_id=?1 AND id=?2)",
      )
      .bind(workspaceId, sourceId, JSON.stringify(chunks));
  }
  async deleteSource(workspaceId: string, id: string) {
    await this.source(workspaceId, id);
    await this.db.batch([
      this.db
        .prepare(
          "DELETE FROM source_chunks WHERE workspace_id=? AND source_id=?",
        )
        .bind(workspaceId, id),
      this.db
        .prepare("DELETE FROM sources WHERE workspace_id=? AND id=?")
        .bind(workspaceId, id),
    ]);
  }
  async setSourceAiExcluded(
    workspaceId: string,
    id: string,
    excluded: boolean,
  ) {
    const r = await this.db
      .prepare("UPDATE sources SET ai_excluded=? WHERE workspace_id=? AND id=?")
      .bind(excluded ? 1 : 0, workspaceId, id)
      .run();
    if (!r.meta.changes)
      throw new DomainError("NOT_FOUND", 404, "Source not found.");
  }
  /** Sources stored before chunking existed are chunked lazily on first use. */
  async unchunkedSources(workspaceId: string, limit: number) {
    return (
      await this.db
        .prepare(
          "SELECT id,body FROM sources WHERE workspace_id=? AND chunk_count IS NULL LIMIT ?",
        )
        .bind(workspaceId, limit)
        .all<{ id: string; body: string }>()
    ).results;
  }
  async storeChunks(workspaceId: string, sourceId: string, chunks: string[]) {
    await this.db.batch([
      this.insertChunks(workspaceId, sourceId, chunks),
      this.db
        .prepare(
          "UPDATE sources SET chunk_count=? WHERE workspace_id=? AND id=? AND chunk_count IS NULL",
        )
        .bind(chunks.length, workspaceId, sourceId),
    ]);
  }
  async searchChunks(workspaceId: string, match: string, limit: number) {
    return (
      await this.db
        .prepare(
          `SELECT c.id,c.source_id AS sourceId,c.ordinal,c.body FROM source_chunks_fts
             JOIN source_chunks c ON c.id=source_chunks_fts.rowid
             JOIN sources s ON s.id=c.source_id
            WHERE source_chunks_fts MATCH ? AND c.workspace_id=? AND s.ai_excluded=0
            ORDER BY bm25(source_chunks_fts) LIMIT ?`,
        )
        .bind(match, workspaceId, limit)
        .all<RetrievedChunk>()
    ).results;
  }
  /** Opening chunk of the newest sources, used when nothing matches. */
  async leadChunks(workspaceId: string, limit: number) {
    return (
      await this.db
        .prepare(
          `SELECT c.id,c.source_id AS sourceId,c.ordinal,c.body FROM source_chunks c
             JOIN sources s ON s.id=c.source_id
            WHERE c.workspace_id=? AND c.ordinal=0 AND s.ai_excluded=0
            ORDER BY s.created_at DESC LIMIT ?`,
        )
        .bind(workspaceId, limit)
        .all<RetrievedChunk>()
    ).results;
  }

  // ------------------------------------------------------------------- changes
  async changes(
    workspaceId: string,
    filter: {
      productionId?: string;
      status?: ChangeStatus;
      limit: number;
      cursor?: string;
    },
  ): Promise<{ items: Change[]; nextCursor: string | null }> {
    const [created, id] = decodeCursor(filter.cursor);
    const rows = (
      await this.db
        .prepare(
          `SELECT id,created_at,${CHANGE_COLUMNS} FROM changes WHERE workspace_id=?
             AND (?='' OR production_id=?) AND (?='' OR status=?)
             AND (?='' OR created_at<? OR (created_at=? AND id<?))
             ORDER BY created_at DESC,id DESC LIMIT ?`,
        )
        .bind(
          workspaceId,
          filter.productionId ?? "",
          filter.productionId ?? "",
          filter.status ?? "",
          filter.status ?? "",
          created,
          created,
          created,
          id,
          filter.limit + 1,
        )
        .all<ChangeRow & { id: string; created_at: string }>()
    ).results;
    const page = rows.slice(0, filter.limit),
      last = page.at(-1);
    return {
      items: page.map(decodeChange),
      nextCursor:
        rows.length > filter.limit && last
          ? encodeCursor(last.created_at, last.id)
          : null,
    };
  }
  static summarize(c: Change): ChangeSummary {
    return {
      id: c.id,
      productionId: c.productionId,
      itemId: c.itemId,
      baseRevision: c.baseRevision,
      status: c.status,
      createdAt: c.createdAt,
      warnings: c.warnings,
      originKind: c.origin?.kind ?? "server_ai",
      preview: c.after.slice(0, 200),
    };
  }
  async change(workspaceId: string, id: string) {
    const r = await this.db
      .prepare(
        `SELECT ${CHANGE_COLUMNS} FROM changes WHERE workspace_id=? AND id=?`,
      )
      .bind(workspaceId, id)
      .first<ChangeRow>();
    if (!r) throw new DomainError("NOT_FOUND", 404, "Change not found.");
    return decodeChange(r);
  }
  private insertChange(change: Change, runId: string | null) {
    const origin = change.origin;
    return this.db
      .prepare(
        "INSERT INTO changes(id,workspace_id,production_id,data,created_at,status,item_id,before_hash,origin_kind,client_id,run_id) VALUES(?,?,?,?,?,'proposed',?,?,?,?,?)",
      )
      .bind(
        change.id,
        change.workspaceId,
        change.productionId,
        JSON.stringify(change),
        change.createdAt,
        change.itemId,
        change.beforeHash ?? null,
        origin?.kind ?? "server_ai",
        origin?.kind === "client_agent" ? origin.clientId : null,
        runId,
      );
  }
  async addChange(change: Change) {
    await this.insertChange(change, null).run();
    return change;
  }
  async rejectChange(workspaceId: string, id: string, actorId: string) {
    const r = await this.db
      .prepare(
        "UPDATE changes SET status='rejected',decided_by=?,decided_at=? WHERE workspace_id=? AND id=? AND status='proposed'",
      )
      .bind(actorId, now(), workspaceId, id)
      .run();
    const change = await this.change(workspaceId, id);
    if (!r.meta.changes && change.status !== "rejected")
      throw new DomainError(
        "CHANGE_CLOSED",
        409,
        `This proposal is already ${change.status}.`,
      );
    return change;
  }
  async claimGeneration(workspaceId: string, key: string, hash: string) {
    const at = new Date();
    const activeSince = new Date(at.getTime() - 120_000).toISOString();
    const daySince = new Date(at.getTime() - 86_400_000).toISOString();
    // Admission is one atomic SQLite statement, shared across server instances.
    // Failed attempts count too: a provider may charge before the response is lost.
    const r = await this.db
      .prepare(
        `INSERT OR IGNORE INTO generation_requests(workspace_id,key,fingerprint,status,created_at)
         SELECT ?,?,?,'running',?
         WHERE (SELECT COUNT(*) FROM generation_requests WHERE workspace_id=? AND status='running' AND created_at>?) < 2
           AND (SELECT COUNT(*) FROM generation_requests WHERE workspace_id=? AND created_at>?) < 100`,
      )
      .bind(
        workspaceId,
        key,
        hash,
        at.toISOString(),
        workspaceId,
        activeSince,
        workspaceId,
        daySince,
      )
      .run();
    if (r.meta.changes) return null;
    const old = await this.db
      .prepare(
        "SELECT fingerprint,status,change_id AS changeId FROM generation_requests WHERE workspace_id=? AND key=?",
      )
      .bind(workspaceId, key)
      .first<{
        fingerprint: string;
        status: string;
        changeId: string | null;
      }>();
    if (!old)
      throw new DomainError(
        "GENERATION_LIMIT",
        429,
        "Generation limit reached: at most 2 concurrent requests and 100 attempts per workspace in 24 hours. Try again later.",
      );
    if (old.fingerprint !== hash)
      throw new DomainError(
        "IDEMPOTENCY_MISMATCH",
        409,
        "Request key conflict.",
      );
    if (old.changeId) return this.change(workspaceId, old.changeId);
    throw new DomainError(
      old.status === "failed" ? "GENERATION_FAILED" : "GENERATION_PENDING",
      409,
      "This generation was already requested. Use a new request only to retry deliberately.",
    );
  }
  async finishGeneration(change: Change, key: string, runId: string | null) {
    await this.db.batch([
      this.insertChange(change, runId),
      this.db
        .prepare(
          "UPDATE generation_requests SET status='succeeded',change_id=? WHERE workspace_id=? AND key=?",
        )
        .bind(change.id, change.workspaceId, key),
    ]);
    return change;
  }
  async releaseGeneration(workspaceId: string, key: string) {
    await this.db
      .prepare(
        "DELETE FROM generation_requests WHERE workspace_id=? AND key=? AND status='running'",
      )
      .bind(workspaceId, key)
      .run();
  }
  async failGeneration(workspaceId: string, key: string) {
    await this.db
      .prepare(
        "UPDATE generation_requests SET status='failed' WHERE workspace_id=? AND key=? AND status='running'",
      )
      .bind(workspaceId, key)
      .run();
  }

  // -------------------------------------------------------------------- ledger
  async recordRun(run: RunRecord) {
    await this.db
      .prepare(
        `INSERT INTO ai_runs(id,workspace_id,actor_id,channel,client_id,task,task_version,provider,model,attempt,status,
           input_tokens,cached_input_tokens,output_tokens,reasoning_tokens,cost_micros,latency_ms,error_code,redactions,context_hash,created_at)
         VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      )
      .bind(
        run.id,
        run.workspaceId,
        run.actorId,
        run.channel,
        run.clientId,
        run.task,
        run.taskVersion,
        run.provider,
        run.model,
        run.attempt,
        run.status,
        run.inputTokens,
        run.cachedInputTokens,
        run.outputTokens,
        run.reasoningTokens,
        run.costMicros,
        run.latencyMs,
        run.errorCode,
        run.redactions,
        run.contextHash,
        now(),
      )
      .run();
  }
  /**
   * Billable tokens = uncached input + output (reasoning is part of output).
   * Cached input is excluded because providers bill it at a small fraction.
   */
  async usage(
    by: { actorId: string } | { workspaceId: string },
    since: string,
  ) {
    const [column, value] =
      "actorId" in by
        ? ["actor_id", by.actorId]
        : ["workspace_id", by.workspaceId];
    const r = await this.db
      .prepare(
        `SELECT COUNT(*) AS runs,
                COALESCE(SUM(COALESCE(input_tokens,0)),0) AS inputTokens,
                COALESCE(SUM(COALESCE(cached_input_tokens,0)),0) AS cachedInputTokens,
                COALESCE(SUM(COALESCE(output_tokens,0)),0) AS outputTokens,
                COALESCE(SUM(COALESCE(cost_micros,0)),0) AS costMicros
           FROM ai_runs WHERE ${column}=? AND created_at>=?`,
      )
      .bind(value, since)
      .first<{
        runs: number;
        inputTokens: number;
        cachedInputTokens: number;
        outputTokens: number;
        costMicros: number;
      }>();
    const u = r ?? {
      runs: 0,
      inputTokens: 0,
      cachedInputTokens: 0,
      outputTokens: 0,
      costMicros: 0,
    };
    return {
      ...u,
      billableTokens: u.inputTokens - u.cachedInputTokens + u.outputTokens,
    };
  }
  async recordAudit(e: AuditRecord) {
    await this.db
      .prepare(
        "INSERT INTO audit_events(id,workspace_id,actor_id,channel,client_id,operation,target_id,outcome,error_code,request_id,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)",
      )
      .bind(
        crypto.randomUUID(),
        e.workspaceId,
        e.actorId,
        e.channel,
        e.clientId,
        e.operation,
        e.targetId,
        e.outcome,
        e.errorCode,
        e.requestId,
        now(),
      )
      .run();
  }

  // ----------------------------------------------------------------- retention
  /** Removes an account's access; sole-owned workspaces enter deletion. */
  async removeUser(userId: string) {
    const at = now();
    await this.db.batch([
      this.db
        .prepare(
          `UPDATE workspaces SET deleted_at=?1 WHERE deleted_at IS NULL
             AND id IN (SELECT workspace_id FROM memberships WHERE user_id=?2 AND role='owner')
             AND NOT EXISTS (SELECT 1 FROM memberships m WHERE m.workspace_id=workspaces.id AND m.role='owner' AND m.user_id<>?2)`,
        )
        .bind(at, userId),
      this.db.prepare("DELETE FROM memberships WHERE user_id=?").bind(userId),
      ...["revisions", "ai_runs", "audit_events"].map((table) =>
        this.db
          .prepare(
            `UPDATE ${table} SET actor_id='deleted-user' WHERE actor_id=?`,
          )
          .bind(userId),
      ),
    ]);
  }
  /** Bounded per call so one cron invocation stays within its time limit. */
  async purge(at = Date.now(), batch = 5000) {
    const del = (table: string, where: string, ...args: unknown[]) =>
      this.db
        .prepare(
          `DELETE FROM ${table} WHERE rowid IN (SELECT rowid FROM ${table} WHERE ${where} LIMIT ${batch})`,
        )
        .bind(...args)
        .run()
        .then((r) => r.meta.changes);
    const counts: Record<string, number> = {
      commands: await del(
        "commands",
        "created_at<?",
        daysAgo(RETENTION.commandDays, at),
      ),
      generationRequests: await del(
        "generation_requests",
        "created_at<?",
        daysAgo(RETENTION.generationRequestDays, at),
      ),
      changes: await del(
        "changes",
        "(status<>'proposed' AND COALESCE(decided_at,created_at)<?1) OR (status='proposed' AND created_at<?1)",
        daysAgo(RETENTION.decidedChangeDays, at),
      ),
      aiRuns: await del(
        "ai_runs",
        "created_at<?",
        daysAgo(RETENTION.ledgerDays, at),
      ),
      auditEvents: await del(
        "audit_events",
        "created_at<?",
        daysAgo(RETENTION.ledgerDays, at),
      ),
      workspaces: 0,
    };
    const expired = (
      await this.db
        .prepare(
          "SELECT id FROM workspaces WHERE deleted_at IS NOT NULL AND deleted_at<? LIMIT 10",
        )
        .bind(daysAgo(RETENTION.workspaceGraceDays, at))
        .all<{ id: string }>()
    ).results;
    for (const { id } of expired) {
      await this.db.batch(
        [
          "search_docs",
          "source_chunks",
          "sources",
          "changes",
          "revisions",
          "productions",
          "commands",
          "generation_requests",
          "memberships",
        ]
          .map((table) =>
            this.db
              .prepare(`DELETE FROM ${table} WHERE workspace_id=?`)
              .bind(id),
          )
          .concat(
            this.db.prepare("DELETE FROM workspaces WHERE id=?").bind(id),
          ),
      );
      counts.workspaces++;
    }
    return counts;
  }
}
