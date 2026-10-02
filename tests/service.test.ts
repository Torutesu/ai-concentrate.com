import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { Repository } from "../lib/server/repository";
import { StudioService, generateProposal } from "../lib/server/service";
import { newProduction } from "../lib/domain/seed";
let mf: Miniflare,
  repo: Repository,
  owner: StudioService,
  other: StudioService,
  viewer: StudioService;
before(async () => {
  mf = new Miniflare({
    modules: true,
    script: 'export default {fetch(){return new Response("ok")}}',
    compatibilityDate: "2026-05-15",
    d1Databases: ["DB"],
  });
  const db = await mf.getD1Database("DB");
  const sql = await readFile("drizzle/0000_wonderful_colleen_wing.sql", "utf8");
  for (const statement of sql.split("--> statement-breakpoint"))
    await db.prepare(statement.trim()).run();
  repo = new Repository(db as unknown as D1Database);
  await repo.create("alice", "A", "wa");
  await repo.create("bob", "B", "wb");
  await db
    .prepare(
      "INSERT INTO memberships(workspace_id,user_id,role) VALUES('wa','read-only','viewer')",
    )
    .run();
  owner = new StudioService(repo, "alice");
  other = new StudioService(repo, "bob");
  viewer = new StudioService(repo, "read-only");
});
after(async () => {
  await mf?.dispose();
});
test("tenant and role isolation applies to reads and writes", async () => {
  await assert.rejects(other.read("wa"), { code: "NOT_FOUND" });
  await assert.rejects(
    viewer.save("wa", "forbidden", newProduction(), 0, "nope"),
    { code: "FORBIDDEN" },
  );
  assert.equal((await viewer.read("wa")).length, 0);
});
test("concurrent saves use CAS and preserve exactly one new revision", async () => {
  const base = await owner.save(
    "wa",
    "race",
    newProduction(),
    0,
    "create-race",
  );
  const results = await Promise.allSettled([
    owner.save("wa", "race", { ...base.data, title: "A" }, 1, "race-a"),
    owner.save("wa", "race", { ...base.data, title: "B" }, 1, "race-b"),
  ]);
  assert.equal(results.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal(results.filter((x) => x.status === "rejected").length, 1);
  assert.equal((await repo.get("wa", "race"))?.revision, 2);
  assert.equal((await repo.history("wa", "race")).length, 2);
});
test("identical retried command replays result; changed input rejects", async () => {
  const data = newProduction("Retry");
  const values = await Promise.all([
    owner.save("wa", "retry", data, 0, "retry-key"),
    owner.save("wa", "retry", data, 0, "retry-key"),
  ]);
  assert.deepEqual(values[0], values[1]);
  assert.equal((await repo.history("wa", "retry")).length, 1);
  await assert.rejects(
    owner.save("wa", "retry", { ...data, title: "Changed" }, 0, "retry-key"),
    { code: "IDEMPOTENCY_MISMATCH" },
  );
});
test("locked item cannot be edited or removed by a save", async () => {
  const data = newProduction();
  data.items[0].locked = true;
  await owner.save("wa", "locked", data, 0, "lock-create");
  const next = structuredClone(data);
  next.items[0].locked = false;
  next.items[0].body = "Overwritten";
  await assert.rejects(owner.save("wa", "locked", next, 1, "lock-edit"), {
    code: "LOCKED",
  });
  next.items[0].body = "";
  await owner.save("wa", "locked", next, 1, "unlock-only");
  next.items[0].body = "Allowed";
  assert.equal(
    (await owner.save("wa", "locked", next, 2, "unlocked-edit")).revision,
    3,
  );
});
test("generation is a proposal, idempotent and scoped; applying only changes target", async () => {
  const data = newProduction();
  data.items.push({ ...data.items[0], id: "second", body: "Keep me" });
  await owner.save("wa", "generate", data, 0, "gen-create");
  let calls = 0;
  const provider = {
    async revise() {
      calls++;
      return "Generated text";
    },
  };
  const input = {
    productionId: "generate",
    itemId: data.items[0].id,
    baseRevision: 1,
    instruction: "Rewrite",
    idempotencyKey: "gen-request",
  };
  const c = await generateProposal(owner, provider, "wa", input);
  assert.equal((await repo.get("wa", "generate"))?.data.items[0].body, "");
  assert.equal((await generateProposal(owner, provider, "wa", input)).id, c.id);
  assert.equal(calls, 1);
  await assert.rejects(other.apply("wb", c.id), { code: "NOT_FOUND" });
  const applied = await owner.apply("wa", c.id);
  assert.equal(applied.data.items[0].body, "Generated text");
  assert.equal(applied.data.items[1].body, "Keep me");
  assert.deepEqual(await owner.apply("wa", c.id), applied);
});
test("stale proposal does not overwrite a later human edit", async () => {
  const p = await owner.save("wa", "stale", newProduction(), 0, "stale-create");
  const c = await generateProposal(
    owner,
    {
      async revise() {
        return "AI";
      },
    },
    "wa",
    {
      productionId: "stale",
      itemId: p.data.items[0].id,
      baseRevision: 1,
      instruction: "Rewrite",
      idempotencyKey: "stale-gen",
    },
  );
  const data = structuredClone(p.data);
  data.items[0].body = "Human";
  await owner.save("wa", "stale", data, 1, "human-change");
  await assert.rejects(owner.apply("wa", c.id), { code: "CONFLICT" });
  assert.equal((await repo.get("wa", "stale"))?.data.items[0].body, "Human");
});

test("marketing generation receives the saved brief and channel without cross-tenant sources", async () => {
  const data = newProduction("Specific launch");
  data.persona = "Project managers";
  data.problem = "Repeatedly explaining context";
  data.metric = "First useful result";
  data.items[0].kind = "x";
  await owner.save("wa", "brief-test", data, 0, "brief-create");
  await other.addSource("wb", {
    name: "Private",
    kind: "markdown",
    reference: "",
    body: "Never leak this",
  });
  await generateProposal(
    owner,
    {
      async revise(input) {
        assert.equal(input.kind, "x");
        assert.equal(input.brief.persona, data.persona);
        assert.equal(input.brief.metric, data.metric);
        assert.ok(input.playbookVersion);
        assert.ok(
          input.sources.every((s) => !s.body.includes("Never leak this")),
        );
        return "Scoped draft";
      },
    },
    "wa",
    {
      productionId: "brief-test",
      itemId: data.items[0].id,
      baseRevision: 1,
      instruction: "Improve clarity",
      idempotencyKey: "brief-generation",
    },
  );
});

test("review exposes missing inputs without claiming factual correctness or predicted reach", async () => {
  const { executeOperation } = await import("../lib/server/operations");
  const report = (await executeOperation(owner, "production_review", {
    workspaceId: "wa",
    productionId: "brief-test",
  })) as {
    missing: string[];
    readyForEditorialReview: boolean;
    requiresHumanReview: string[];
  };
  assert.ok(report.missing.includes("cta"));
  assert.equal(report.readyForEditorialReview, false);
  assert.ok(report.requiresHumanReview.includes("claim-support"));
  await assert.rejects(
    executeOperation(other, "production_review", {
      workspaceId: "wa",
      productionId: "brief-test",
    }),
    { code: "NOT_FOUND" },
  );
});

test("restoring a revision creates history and respects concurrent edits", async () => {
  const p = await owner.save(
    "wa",
    "restore-test",
    newProduction("Original"),
    0,
    "restore-create",
  );
  await owner.save(
    "wa",
    p.id,
    { ...p.data, title: "Edited" },
    1,
    "restore-edit",
  );
  const restored = await owner.restore("wa", p.id, 1, 2, "restore-old");
  assert.equal(restored.revision, 3);
  assert.equal(restored.data.title, "Original");
  await assert.rejects(owner.restore("wa", p.id, 2, 2, "restore-stale"), {
    code: "CONFLICT",
  });
});

test("MCP exposes review as read-only and rejects unknown tool arguments", async () => {
  const { dispatchMcp, toolDefinitions } = await import("../lib/server/mcp");
  const { executeOperation } = await import("../lib/server/operations");
  assert.equal(
    toolDefinitions.find((t) => t.name === "production_review")?.annotations
      .readOnlyHint,
    true,
  );
  const result = await dispatchMcp(
    {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "production_review",
        arguments: {
          workspaceId: "wa",
          productionId: "brief-test",
          bypass: true,
        },
      },
    },
    (name, input) => executeOperation(owner, name, input),
  );
  assert.equal(
    (result as { result: { isError: boolean } }).result.isError,
    true,
  );
  assert.equal(
    await dispatchMcp(
      { jsonrpc: "2.0", method: "notifications/initialized" },
      async () => {
        throw Error("Must not execute");
      },
    ),
    null,
  );
});

test("keyset pages contain only summaries and do not lose entries across page boundaries", async () => {
  await repo.create("alice", "Pagination", "pages");
  for (let i = 0; i < 5; i++)
    await owner.save(
      "pages",
      `page-${i}`,
      newProduction(`Item ${i}`),
      0,
      `page-create-${i}`,
    );
  const seen = new Set<string>();
  let cursor: string | undefined;
  do {
    const page = await owner.page("pages", 2, cursor);
    for (const item of page.items) {
      assert.ok(!seen.has(item.id));
      assert.ok(!("data" in item));
      seen.add(item.id);
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  assert.equal(seen.size, 5);
  await assert.rejects(other.page("pages", 2), { code: "NOT_FOUND" });
  await assert.rejects(owner.page("pages", 2, "broken"), { code: "CURSOR" });
});
