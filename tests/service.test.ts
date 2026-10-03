import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { createClient, type Client } from "@libsql/client";
import { LibsqlDatabase } from "../lib/platform/libsql";
import type { Database } from "../lib/platform/database";
let libsqlClient: Client | undefined;
import { Repository } from "../lib/server/repository";
import { StudioService, generateProposal } from "../lib/server/service";
import { newProduction } from "../lib/domain/seed";
let mf: Miniflare,
  repo: Repository,
  owner: StudioService,
  other: StudioService,
  viewer: StudioService;
before(async () => {
  let db: Database;
  if (process.env.TEST_DATABASE === "libsql") {
    libsqlClient = createClient({ url: "file::memory:" });
    db = new LibsqlDatabase(libsqlClient);
  } else {
    mf = new Miniflare({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      compatibilityDate: "2026-05-15",
      d1Databases: ["DB"],
    });
    db = (await mf.getD1Database("DB")) as unknown as Database;
  }
  const sql = await readFile("drizzle/0000_wonderful_colleen_wing.sql", "utf8");
  for (const statement of sql.split("--> statement-breakpoint"))
    await db.prepare(statement.trim()).run();
  repo = new Repository(db);
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
  libsqlClient?.close();
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

test("search covers unloaded titles and bodies with literal wildcards and tenant isolation", async () => {
  const { executeOperation } = await import("../lib/server/operations");
  await repo.create("alice", "Search", "search");
  const data = newProduction("企画の検索");
  data.items[0].body = "本文だけの単語 100%_literal";
  await owner.save("search", "find", data, 0, "search-create");
  await owner.save(
    "search",
    "skip",
    newProduction("Unrelated"),
    0,
    "search-skip",
  );
  for (const query of ["企画", "本文だけ", "%_", "LITERAL"]) {
    const page = await owner.page("search", 1, undefined, query);
    assert.deepEqual(
      page.items.map((i) => i.id),
      ["find"],
    );
    assert.equal(page.nextCursor, null);
  }
  assert.equal(
    (await owner.page("search", 1, undefined, "absent")).items.length,
    0,
  );
  await assert.rejects(
    executeOperation(other, "production_list", {
      workspaceId: "search",
      query: "本文",
    }),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    executeOperation(owner, "production_list", {
      workspaceId: "search",
      query: "a".repeat(201),
    }),
  );
});

test("history pages retain all revisions and snapshots are read-only and tenant-scoped", async () => {
  const { executeOperation } = await import("../lib/server/operations");
  const data = newProduction("History");
  for (let i = 0; i < 33; i++)
    await owner.save(
      "wa",
      "long-history",
      { ...data, title: `Revision ${i + 1}` },
      i,
      `history-${i}`,
    );
  let before: number | undefined;
  const seen: number[] = [];
  do {
    const page = await owner.historyPage("wa", "long-history", 10, before);
    seen.push(...page.items.map((r) => r.revision));
    before = page.nextBefore ?? undefined;
  } while (before);
  assert.deepEqual(
    seen,
    Array.from({ length: 33 }, (_, i) => 33 - i),
  );
  const snapshot = await viewer.snapshot("wa", "long-history", 1);
  assert.equal(snapshot.data.title, "Revision 1");
  assert.equal((await repo.get("wa", "long-history"))?.revision, 33);
  await assert.rejects(other.snapshot("wa", "long-history", 1), {
    code: "NOT_FOUND",
  });
  await assert.rejects(other.historyPage("wa", "long-history", 10), {
    code: "NOT_FOUND",
  });
  await assert.rejects(owner.snapshot("wa", "long-history", 999), {
    code: "NOT_FOUND",
  });
  await assert.rejects(
    executeOperation(owner, "production_history", {
      workspaceId: "wa",
      productionId: "long-history",
      limit: 1000,
    }),
  );
});

test("generation admission is atomic, tenant scoped and replay safe at capacity", async () => {
  await repo.create("alice", "Limits", "limits");
  const claims = await Promise.allSettled(
    Array.from({ length: 8 }, (_, i) =>
      repo.claimGeneration("limits", `g${i}`, `h${i}`),
    ),
  );
  assert.equal(claims.filter((r) => r.status === "fulfilled").length, 2);
  for (const r of claims.filter((r) => r.status === "rejected"))
    assert.equal(r.reason.code, "GENERATION_LIMIT");
  const first = claims.findIndex((r) => r.status === "fulfilled");
  await assert.rejects(
    repo.claimGeneration("limits", `g${first}`, `h${first}`),
    { code: "GENERATION_PENDING" },
  );
  await repo.failGeneration("limits", `g${first}`);
  assert.equal(
    await repo.claimGeneration("limits", "replacement", "replacement"),
    null,
  );
  assert.equal(
    await repo.claimGeneration("other-limit-tenant", "independent", "h"),
    null,
  );
});
test("failed provider attempts still consume the rolling daily allowance", async () => {
  for (let i = 0; i < 100; i++) {
    await repo.claimGeneration("daily-limit", `g${i}`, "h");
    await repo.failGeneration("daily-limit", `g${i}`);
  }
  await assert.rejects(repo.claimGeneration("daily-limit", "overflow", "h"), {
    code: "GENERATION_LIMIT",
  });
});

test("provider errors are actionable without leaking upstream content", async () => {
  const { createOpenAIProvider } = await import(
    "../lib/server/openai-provider"
  );
  const input = {
    title: "Test",
    kind: "draft" as const,
    playbookVersion: "test",
    brief: {
      persona: "",
      problem: "",
      claim: "",
      hypothesis: "",
      cta: "",
      destination: "",
      metric: "",
      evaluationDate: "",
    },
    sourceCoverage: { selected: 0, truncated: false },
    locale: "ja",
    body: "",
    instruction: "Draft",
    sources: [],
  };
  for (const [status, code] of [
    [401, "PROVIDER_AUTH"],
    [403, "PROVIDER_AUTH"],
    [429, "PROVIDER_CAPACITY"],
    [500, "PROVIDER_ERROR"],
  ] as const) {
    const provider = createOpenAIProvider(
      { OPENAI_API_KEY: "test", OPENAI_MODEL: "test" },
      async () => new Response("private upstream content", { status }),
    );
    await assert.rejects(provider.revise(input), (e: unknown) => {
      assert.equal((e as { code: string }).code, code);
      assert.ok(!(e as Error).message.includes("private"));
      return true;
    });
  }
  const timeout = createOpenAIProvider(
    { OPENAI_API_KEY: "test", OPENAI_MODEL: "test" },
    async () => {
      throw new DOMException("private", "TimeoutError");
    },
  );
  await assert.rejects(timeout.revise(input), { code: "PROVIDER_TIMEOUT" });
  const valid = createOpenAIProvider(
    { OPENAI_API_KEY: "test", OPENAI_MODEL: "test" },
    async () =>
      Response.json({
        status: "completed",
        output: [
          {
            content: [
              { type: "output_text", text: '{"body":"確認済みの初稿"}' },
            ],
          },
        ],
      }),
  );
  assert.equal(await valid.revise(input), "確認済みの初稿");
});

test("workflow distinguishes content preparation from actual learning", async () => {
  const { productionWorkflow } = await import("../lib/domain/workflow");
  const p = newProduction();
  assert.equal(productionWorkflow(null, 0).next, "context");
  assert.equal(productionWorkflow(p, 1).next, "strategy");
  Object.assign(p, {
    persona: "Founders",
    problem: "Lost context",
    claim: "Resume work",
    cta: "Try",
    destination: "https://example.test",
    metric: "Activated users",
    plannedDate: "2026-10-10",
    evaluationDate: "2026-10-17",
  });
  assert.equal(productionWorkflow(p, 1).next, "draft");
  p.items[0].body = "A real draft";
  const flow = productionWorkflow(p, 1);
  assert.equal(flow.next, "analytics");
  assert.equal(
    flow.complete,
    false,
    "A scheduled draft is not evidence of learning or publication",
  );
  p.decision =
    "Measured 3 activated users. Revise the opening and run another test.";
  assert.equal(productionWorkflow(p, 1).complete, true);
  assert.equal(
    productionWorkflow(p, 0).next,
    "context",
    "Deleting all sources must reopen the evidence step",
  );
});
