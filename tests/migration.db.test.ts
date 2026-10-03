import { test } from "node:test";
import assert from "node:assert/strict";
import { Repository } from "../lib/server/repository";
import { StudioService } from "../lib/server/service";
import {
  applyMigrations,
  createDatabase,
  human,
  migrationFiles,
} from "./helpers";

test("every migration applies to an empty database", async () => {
  const { db, close } = await createDatabase();
  const tables = (
    await db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type IN ('table','trigger') ORDER BY name",
      )
      .all<{ name: string }>()
  ).results.map((r) => r.name);
  for (const name of [
    "ai_runs",
    "audit_events",
    "search_docs",
    "search_fts",
    "source_chunks_fts",
    "search_docs_ai",
  ])
    assert.ok(tables.includes(name), name);
  await close();
});

test("0001 backfills summaries, search, slim receipts and proposal status from 0000 data", async () => {
  const [first, second] = await migrationFiles();
  const { db, close } = await createDatabase(first.slice(0, 4));
  for (const sql of [
    "INSERT INTO workspaces(id,name,owner_id,created_at) VALUES('w','W','u','2026-01-01')",
    "INSERT INTO memberships VALUES('w','u','owner')",
    `INSERT INTO productions VALUES('w','p',2,'{"title":"月曜の朝","persona":"","problem":"","claim":"","hypothesis":"","cta":"","destination":"","metric":"","evaluationDate":"","plannedDate":"2026-10-08","decision":"","items":[{"id":"a","kind":"draft","locale":"ja","title":"原稿","body":"前回の判断から再開","locked":false},{"id":"b","kind":"x","locale":"ja","title":"X","body":"hello","locked":false}]}','k2','2026-01-02')`,
    `INSERT INTO revisions VALUES('w','p',2,(SELECT data FROM productions),'u','2026-01-02')`,
    `INSERT INTO commands VALUES('w','k2','f','{"id":"p","workspaceId":"w","revision":2,"data":{"title":"x"},"updatedAt":"2026-01-02"}')`,
    `INSERT INTO commands VALUES('w','apply_c1','f2','{"id":"p","workspaceId":"w","revision":2,"data":{"title":"x"},"updatedAt":"2026-01-02"}')`,
    `INSERT INTO changes VALUES('c1','w','p','{"id":"c1","itemId":"a","baseRevision":1,"before":"","after":"x"}','2026-01-01')`,
    `INSERT INTO changes VALUES('c2','w','p','{"id":"c2","itemId":"b","baseRevision":1,"before":"","after":"y"}','2026-01-01')`,
    `INSERT INTO changes VALUES('c3','w','p','{"id":"c3","workspaceId":"w","productionId":"p","itemId":"b","baseRevision":2,"before":"hello","after":"hi","instruction":"i","sourceIds":[],"createdAt":"2026-01-02"}','2026-01-02')`,
    "INSERT INTO sources VALUES('s','w','doc','markdown','','製品の説明','h','2026-01-01')",
  ])
    await db.prepare(sql).run();
  await applyMigrations(db, undefined, second);
  const one = <T>(sql: string) => db.prepare(sql).first<T>();
  assert.deepEqual(
    await one(
      "SELECT title,planned_date AS plannedDate,item_count AS itemCount FROM productions",
    ),
    { title: "月曜の朝", plannedDate: "2026-10-08", itemCount: 2 },
  );
  assert.deepEqual(
    JSON.parse(
      (await one<{ result: string }>(
        "SELECT result FROM commands WHERE key='k2'",
      ))!.result,
    ),
    { productionId: "p", revision: 2 },
  );
  const statuses = (
    await db
      .prepare("SELECT id,status FROM changes ORDER BY id")
      .all<{ id: string; status: string }>()
  ).results.map((r) => [r.id, r.status]);
  assert.deepEqual(statuses, [
    ["c1", "applied"],
    ["c2", "stale"],
    ["c3", "proposed"],
  ]);
  assert.deepEqual(await one("SELECT chars,preview FROM sources"), {
    chars: 5,
    preview: "製品の説明",
  });

  // The repository works on migrated data: search, receipt replay, legacy proposal apply.
  const service = new StudioService(new Repository(db), human("u"));
  assert.deepEqual(
    (await service.page("w", 10, undefined, "判断から")).items.map((i) => i.id),
    ["p"],
  );
  const replay = await new Repository(db).receipt("w", "k2", "f");
  assert.equal(replay?.revision, 2);
  const applied = await service.apply("w", "c3");
  assert.equal(applied.data.items[1].body, "hi");
  await close();
});
