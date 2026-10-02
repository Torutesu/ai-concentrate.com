import type { Database } from "../platform/database";
import {
  DomainError,
  productionSchema,
  type Production,
  type Role,
  type Source,
  type VersionedProduction,
  type Workspace,
  type Change,
} from "../domain/models";

export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
export class Repository {
  constructor(private db: Database) {}
  async role(workspaceId: string, userId: string): Promise<Role> {
    const row = await this.db
      .prepare(
        "SELECT role FROM memberships WHERE workspace_id=? AND user_id=?",
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
          "SELECT w.id,w.name,m.role FROM workspaces w JOIN memberships m ON m.workspace_id=w.id WHERE m.user_id=? ORDER BY w.created_at,w.id LIMIT 100",
        )
        .bind(userId)
        .all<Workspace>()
    ).results;
  }
  async create(
    userId: string,
    name: string,
    id = crypto.randomUUID(),
  ): Promise<Workspace> {
    await this.db.batch([
      this.db
        .prepare(
          "INSERT OR IGNORE INTO workspaces(id,name,owner_id,created_at) VALUES(?,?,?,?)",
        )
        .bind(id, name, userId, new Date().toISOString()),
      this.db
        .prepare(
          "INSERT OR IGNORE INTO memberships(workspace_id,user_id,role) SELECT id,owner_id,'owner' FROM workspaces WHERE id=? AND owner_id=?",
        )
        .bind(id, userId),
    ]);
    const role = await this.role(id, userId);
    const workspace = await this.db
      .prepare("SELECT name FROM workspaces WHERE id=?")
      .bind(id)
      .first<{ name: string }>();
    return { id, name: workspace!.name, role };
  }
  async listProductions(workspaceId: string) {
    const rows = await this.db
      .prepare(
        "SELECT * FROM productions WHERE workspace_id=? ORDER BY updated_at DESC,id LIMIT 100",
      )
      .bind(workspaceId)
      .all<Row>();
    return rows.results.map(decode);
  }
  async get(workspaceId: string, id: string) {
    const row = await this.db
      .prepare("SELECT * FROM productions WHERE workspace_id=? AND id=?")
      .bind(workspaceId, id)
      .first<Row>();
    return row ? decode(row) : null;
  }
  async receipt(workspaceId: string, key: string, fingerprint: string) {
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
    return JSON.parse(r.result) as VersionedProduction;
  }
  async save(
    workspaceId: string,
    id: string,
    data: Production,
    base: number,
    key: string,
    hash: string,
    actorId: string,
  ) {
    const existing = await this.receipt(workspaceId, key, hash);
    if (existing) return existing;
    const now = new Date().toISOString(),
      json = JSON.stringify(data),
      next = base + 1;
    const result: VersionedProduction = {
      id,
      workspaceId,
      data,
      revision: next,
      updatedAt: now,
    };
    const mutation =
      base === 0
        ? this.db
            .prepare(
              "INSERT OR IGNORE INTO productions(workspace_id,id,revision,data,last_command,updated_at) VALUES(?,?,?,?,?,?)",
            )
            .bind(workspaceId, id, next, json, key, now)
        : this.db
            .prepare(
              "UPDATE productions SET revision=?,data=?,last_command=?,updated_at=? WHERE workspace_id=? AND id=? AND revision=?",
            )
            .bind(next, json, key, now, workspaceId, id, base);
    try {
      await this.db.batch([
        mutation,
        this.db
          .prepare(
            "INSERT OR IGNORE INTO revisions(workspace_id,production_id,revision,data,actor_id,created_at) SELECT workspace_id,id,revision,data,?,updated_at FROM productions WHERE workspace_id=? AND id=? AND revision=? AND last_command=?",
          )
          .bind(actorId, workspaceId, id, next, key),
        this.db
          .prepare(
            "INSERT INTO commands(workspace_id,key,fingerprint,result) SELECT workspace_id,?,?,? FROM productions WHERE workspace_id=? AND id=? AND revision=? AND last_command=?",
          )
          .bind(key, hash, JSON.stringify(result), workspaceId, id, next, key),
      ]);
    } catch (error) {
      const replay = await this.receipt(workspaceId, key, hash);
      if (replay) return replay;
      throw error;
    }
    const receipt = await this.receipt(workspaceId, key, hash);
    if (!receipt)
      throw new DomainError("CONFLICT", 409, "A newer revision exists.");
    return receipt;
  }
  async pageProductions(
    workspaceId: string,
    limit: number,
    cursor?: string,
    query = "",
  ) {
    let date = "",
      id = "";
    if (cursor) {
      try {
        const parts = JSON.parse(atob(cursor));
        if (
          !Array.isArray(parts) ||
          parts.length !== 2 ||
          parts.some((v) => typeof v !== "string")
        )
          throw Error();
        [date, id] = parts;
      } catch {
        throw new DomainError("CURSOR", 400, "Invalid cursor.");
      }
    }
    const rows = await this.db
      .prepare(
        "SELECT id,revision,updated_at,json_extract(data,'$.title') AS title,json_extract(data,'$.plannedDate') AS plannedDate,json_array_length(data,'$.items') AS itemCount FROM productions WHERE workspace_id=? AND (?='' OR instr(lower(json_extract(data,'$.title')),lower(?))>0 OR EXISTS (SELECT 1 FROM json_each(data,'$.items') item WHERE instr(lower(json_extract(item.value,'$.body')),lower(?))>0)) AND (?='' OR updated_at<? OR (updated_at=? AND id<?)) ORDER BY updated_at DESC,id DESC LIMIT ?",
      )
      .bind(workspaceId, query, query, query, date, date, date, id, limit + 1)
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
      items: items.map((r) => ({ ...r, workspaceId, updatedAt: r.updated_at })),
      nextCursor:
        rows.results.length > limit && last
          ? btoa(JSON.stringify([last.updated_at, last.id]))
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
    return productionSchema.parse(JSON.parse(row.data));
  }
  async history(workspaceId: string, id: string) {
    return (
      await this.db
        .prepare(
          "SELECT revision,actor_id AS actorId,created_at AS createdAt FROM revisions WHERE workspace_id=? AND production_id=? ORDER BY revision DESC LIMIT 30",
        )
        .bind(workspaceId, id)
        .all()
    ).results;
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
  async sources(workspaceId: string): Promise<Source[]> {
    return (
      await this.db
        .prepare(
          "SELECT id,workspace_id AS workspaceId,name,kind,reference,body,hash,created_at AS createdAt FROM sources WHERE workspace_id=? ORDER BY created_at DESC LIMIT 50",
        )
        .bind(workspaceId)
        .all<Source>()
    ).results;
  }
  async addSource(source: Source) {
    await this.db
      .prepare(
        "INSERT INTO sources(id,workspace_id,name,kind,reference,body,hash,created_at) VALUES(?,?,?,?,?,?,?,?)",
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
      )
      .run();
    return source;
  }
  async changes(workspaceId: string) {
    return (
      await this.db
        .prepare(
          "SELECT data FROM changes WHERE workspace_id=? ORDER BY created_at DESC LIMIT 100",
        )
        .bind(workspaceId)
        .all<{ data: string }>()
    ).results.map((r) => JSON.parse(r.data) as Change);
  }
  async change(workspaceId: string, id: string) {
    const r = await this.db
      .prepare("SELECT data FROM changes WHERE workspace_id=? AND id=?")
      .bind(workspaceId, id)
      .first<{ data: string }>();
    if (!r) throw new DomainError("NOT_FOUND", 404, "Change not found.");
    return JSON.parse(r.data) as Change;
  }
  async claimGeneration(workspaceId: string, key: string, hash: string) {
    const r = await this.db
      .prepare(
        "INSERT OR IGNORE INTO generation_requests(workspace_id,key,fingerprint,status,created_at) VALUES(?,?,?,'running',?)",
      )
      .bind(workspaceId, key, hash, new Date().toISOString())
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
    if (old?.fingerprint !== hash)
      throw new DomainError(
        "IDEMPOTENCY_MISMATCH",
        409,
        "Request key conflict.",
      );
    if (old?.changeId) return this.change(workspaceId, old.changeId);
    throw new DomainError(
      old?.status === "failed" ? "GENERATION_FAILED" : "GENERATION_PENDING",
      409,
      "This generation was already requested. Use a new request only to retry deliberately.",
    );
  }
  async finishGeneration(change: Change, key: string) {
    await this.db.batch([
      this.db
        .prepare(
          "INSERT INTO changes(id,workspace_id,production_id,data,created_at) VALUES(?,?,?,?,?)",
        )
        .bind(
          change.id,
          change.workspaceId,
          change.productionId,
          JSON.stringify(change),
          change.createdAt,
        ),
      this.db
        .prepare(
          "UPDATE generation_requests SET status='succeeded',change_id=? WHERE workspace_id=? AND key=?",
        )
        .bind(change.id, change.workspaceId, key),
    ]);
    return change;
  }
  async failGeneration(workspaceId: string, key: string) {
    await this.db
      .prepare(
        "UPDATE generation_requests SET status='failed' WHERE workspace_id=? AND key=? AND status='running'",
      )
      .bind(workspaceId, key)
      .run();
  }
}
type Row = {
  id: string;
  workspace_id: string;
  revision: number;
  data: string;
  updated_at: string;
};
function decode(r: Row): VersionedProduction {
  return {
    id: r.id,
    workspaceId: r.workspace_id,
    revision: r.revision,
    data: productionSchema.parse(JSON.parse(r.data)),
    updatedAt: r.updated_at,
  };
}
