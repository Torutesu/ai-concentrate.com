import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Database } from "../lib/platform/database";
import { Repository } from "../lib/server/repository";
import { StudioService } from "../lib/server/service";
import { executeOperation } from "../lib/server/operations";
import { generateProposal } from "../lib/server/generation";
import { newProduction } from "../lib/domain/seed";
import { digest } from "../lib/domain/hash";
import { LIMITS, RATE_LIMITS, RETENTION } from "../lib/domain/limits";
import type { Change } from "../lib/domain/models";
import { agent, createDatabase, fakeAi, human, replaceWith } from "./helpers";

// Production guards: quotas, rate limits, agent policy, size checks, races
// and retention. Each test uses its own workspace in one shared database.
let db: Database, close: () => Promise<void>, repo: Repository;
const people = (id: string) => new StudioService(repo, human(id));
const scalar = async <T>(sql: string, ...args: unknown[]) =>
  (await db
    .prepare(sql)
    .bind(...args)
    .first<T>())!;
/** Temporarily overrides a shared limit for one test. */
async function withLimit<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K],
  fn: () => Promise<void>,
) {
  const previous = target[key];
  (target as Record<K, T[K]>)[key] = value;
  try {
    await fn();
  } finally {
    (target as Record<K, T[K]>)[key] = previous;
  }
}
const withBody = (body: string) => {
  const data = newProduction("Guarded");
  data.items[0] = { ...data.items[0], body };
  return data;
};

before(async () => {
  ({ db, close } = await createDatabase());
  repo = new Repository(db);
});
after(() => close());

test("agents only propose by default and never see AI-excluded sources", async () => {
  await repo.create("olga", "Agents", "g-agent");
  const owner = people("olga");
  const bot = new StudioService(repo, agent("olga"));
  const p = await owner.save("g-agent", "p", withBody("Hello"), 0, "g1");
  const hash = await digest("Hello");
  await assert.rejects(
    bot.patchItem(
      "g-agent",
      "p",
      p.data.items[0].id,
      hash,
      { body: "x" },
      "a1",
    ),
    { code: "AGENT_PROPOSE_ONLY" },
  );
  await assert.rejects(
    bot.save("g-agent", "p", withBody("x"), p.revision, "a2"),
    { code: "AGENT_PROPOSE_ONLY" },
  );
  const proposal = await bot.propose("g-agent", {
    productionId: "p",
    itemId: p.data.items[0].id,
    baseHash: hash,
    instruction: "Greet",
    replacement: { body: "Hello there" },
    idempotencyKey: "a3",
  });
  await assert.rejects(bot.reject("g-agent", proposal.id), {
    code: "AGENT_PROPOSE_ONLY",
  });

  const open = await owner.addSource("g-agent", {
    name: "Open",
    kind: "markdown",
    reference: "",
    body: "Shared passage about ORCHID launches",
  });
  const hidden = await owner.addSource("g-agent", {
    name: "Hidden",
    kind: "markdown",
    reference: "",
    body: "Private passage about ORCHID pricing",
  });
  await owner.updateSource("g-agent", hidden.id, true);
  assert.deepEqual(
    (await bot.sources("g-agent")).items.map((s) => s.id),
    [open.id],
  );
  await assert.rejects(bot.source("g-agent", hidden.id, 0, 100), {
    code: "AI_POLICY",
  });
  assert.equal((await owner.sources("g-agent")).items.length, 2);
  assert.equal(
    (await owner.source("g-agent", hidden.id, 0, 100)).text.length > 0,
    true,
  );

  const settings = await owner.settings("g-agent");
  await owner.updateSettings("g-agent", settings.revision, {
    policy: { sendSources: "none" },
  });
  assert.deepEqual((await bot.sources("g-agent")).items, []);
  await assert.rejects(bot.source("g-agent", open.id, 0, 100), {
    code: "AI_POLICY",
  });
  await assert.rejects(bot.searchSources("g-agent", "ORCHID", 5), {
    code: "AI_POLICY",
  });
  assert.equal(
    (await owner.searchSources("g-agent", "orchid", 5)).results.length,
    2,
  );
  // The excerpt contains the hit even though the case differs.
  assert.ok(
    (await owner.searchSources("g-agent", "orchid", 5)).results.every((r) =>
      r.excerpt.includes("ORCHID"),
    ),
  );
});

test("ideas, open proposals and owned workspaces are capped atomically", async () => {
  await repo.create("pia", "Caps", "g-caps");
  const owner = people("pia");
  await withLimit(LIMITS, "productionsPerWorkspace", 2 as never, async () => {
    await owner.save("g-caps", "one", withBody("1"), 0, "c1");
    await owner.save("g-caps", "two", withBody("2"), 0, "c2");
    await assert.rejects(
      owner.save("g-caps", "three", withBody("3"), 0, "c3"),
      {
        code: "PRODUCTION_LIMIT",
      },
    );
    // Updating an existing idea is unaffected.
    await owner.save("g-caps", "one", withBody("1b"), 1, "c4");
  });
  const one = (await repo.get("g-caps", "one"))!;
  const itemId = one.data.items[0].id;
  await withLimit(LIMITS, "openChangesPerWorkspace", 1 as never, async () => {
    const hash = await digest("1b");
    const make = (key: string) =>
      owner.propose("g-caps", {
        productionId: "one",
        itemId,
        baseHash: hash,
        instruction: "x",
        replacement: { body: key },
        idempotencyKey: key,
      });
    // Concurrent replays of one key store one proposal and agree.
    const [a, b] = await Promise.all([make("k1"), make("k1")]);
    assert.equal(a.id, b.id);
    await assert.rejects(make("k2"), { code: "PROPOSAL_LIMIT" });
    await assert.rejects(
      generateProposal(
        owner,
        fakeAi(() => replaceWith("AI")).config,
        "g-caps",
        {
          productionId: "one",
          itemId,
          baseRevision: 2,
          instruction: "x",
          idempotencyKey: "gen-1",
        },
      ),
      { code: "PROPOSAL_LIMIT" },
    );
  });

  await withLimit(LIMITS, "workspacesPerOwner", 2 as never, async () => {
    await owner.createWorkspace("g-caps-2", "Second");
    await owner.deleteWorkspace("g-caps-2");
    // A workspace deleted moments ago still counts until it is purged.
    await assert.rejects(owner.createWorkspace("g-caps-3", "Third"), {
      code: "WORKSPACE_LIMIT",
    });
  });
});

test("writes and AI calls are rate limited per user across transports", async () => {
  await repo.create("rita", "Rate", "g-rate");
  const owner = people("rita");
  const ctx = {
    service: owner,
    ai: () => fakeAi(() => replaceWith("x")).config,
  };
  await withLimit(RATE_LIMITS.writes, "limit", 2 as never, async () => {
    const create = (id: string) =>
      executeOperation(ctx, "production_save", {
        workspaceId: "g-rate",
        productionId: id,
        baseRevision: 0,
        idempotencyKey: `rate-${id}`,
        data: withBody(id),
      });
    await create("r1");
    await create("r2");
    await assert.rejects(
      create("r3"),
      (e: { code?: string; retryAfter?: number }) => {
        assert.equal(e.code, "RATE_LIMITED");
        assert.ok(e.retryAfter && e.retryAfter > 0 && e.retryAfter <= 60);
        return true;
      },
    );
    // Reads are never limited.
    await executeOperation(ctx, "production_list", { workspaceId: "g-rate" });
  });
  const denied = await scalar<{ n: number }>(
    "SELECT COUNT(*) AS n FROM audit_events WHERE actor_id='rita' AND error_code='RATE_LIMITED'",
  );
  assert.equal(denied.n, 1);
});

test("AI output and applied proposals respect the per-item size limit", async () => {
  await repo.create("sam", "Size", "g-size");
  const owner = people("sam");
  const p = await owner.save("g-size", "big", withBody("short"), 0, "s1");
  const itemId = p.data.items[0].id;
  const huge = "あ".repeat(Math.ceil(LIMITS.itemBodyBytes / 3) + 10);
  await assert.rejects(
    generateProposal(owner, fakeAi(() => replaceWith(huge)).config, "g-size", {
      productionId: "big",
      itemId,
      baseRevision: 1,
      instruction: "expand",
      idempotencyKey: "big-gen",
    }),
    { code: "ITEM_TOO_LARGE" },
  );
  // A stored oversized proposal (e.g. from before this check) cannot be applied.
  const change: Change = {
    id: "oversized",
    workspaceId: "g-size",
    productionId: "big",
    itemId,
    baseRevision: 1,
    beforeHash: await digest("short"),
    before: "short",
    after: huge,
    instruction: "expand",
    sourceIds: [],
    createdAt: new Date().toISOString(),
    status: "proposed",
    warnings: [],
  };
  await repo.addChange(change);
  await assert.rejects(owner.apply("g-size", "oversized"), {
    code: "ITEM_TOO_LARGE",
  });
  assert.equal((await repo.get("g-size", "big"))!.data.items[0].body, "short");
});

test("applying a proposal that was rejected meanwhile changes nothing", async () => {
  await repo.create("tia", "Race", "g-race");
  const owner = people("tia");
  const p = await owner.save("g-race", "r", withBody("before"), 0, "t1");
  const itemId = p.data.items[0].id;
  const proposal = await owner.propose("g-race", {
    productionId: "r",
    itemId,
    baseHash: await digest("before"),
    instruction: "x",
    replacement: { body: "after" },
    idempotencyKey: "t2",
  });
  await repo.rejectChange("g-race", proposal.id, "someone");
  // The save that would carry the apply loses: the production stays as it was.
  const data = structuredClone(p.data);
  data.items[0].body = "after";
  await assert.rejects(
    repo.save({
      workspaceId: "g-race",
      id: "r",
      data,
      base: p.revision,
      key: "apply_" + proposal.id,
      fingerprint: "f",
      actorId: "tia",
      itemHashes: [],
      appliedChangeId: proposal.id,
    }),
    { code: "CHANGE_CLOSED" },
  );
  assert.equal((await repo.get("g-race", "r"))!.revision, p.revision);
});

test("abandoned generation claims close instead of staying pending", async () => {
  await repo.create("uma", "Claims", "g-claim");
  const old = new Date(Date.now() - 10 * 60_000).toISOString();
  await db
    .prepare(
      "INSERT INTO generation_requests(workspace_id,key,fingerprint,status,created_at) VALUES('g-claim','k1','h1','running',?),('g-claim','k2','h2','running',?)",
    )
    .bind(old, old)
    .run();
  await assert.rejects(repo.claimGeneration("g-claim", "k1", "h1"), {
    code: "GENERATION_FAILED",
  });
  assert.equal(await repo.claimGeneration("g-claim", "k3", "h3"), null);
});

test("budgets: per user and deployment-wide", async () => {
  await repo.create("vic", "Budget", "g-budget");
  const owner = people("vic");
  await repo.recordRun({
    id: "run-1",
    workspaceId: "g-budget",
    actorId: "someone-else",
    channel: "web",
    clientId: null,
    task: "item.revise",
    taskVersion: "v",
    provider: "fake",
    model: "m",
    attempt: 1,
    status: "succeeded",
    inputTokens: 900,
    cachedInputTokens: 100,
    outputTokens: 200,
    reasoningTokens: null,
    costMicros: null,
    latencyMs: 1,
    errorCode: null,
    redactions: 0,
    contextHash: null,
  });
  const now = new Date();
  const since = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
  ).toISOString();
  // Other tests in this database also spend; compare against the real total.
  const total = await repo.totalBillableTokens(since);
  assert.ok(total >= 1_000);
  await owner.assertBudget(1_000_000, 0);
  await owner.assertBudget(1_000_000, total + 1);
  await assert.rejects(owner.assertBudget(1_000_000, total), {
    code: "AI_BUDGET",
  });
});

test("retention keeps recent revisions, purges in resumable steps and anonymizes", async () => {
  await repo.create("wes", "Retention", "g-ret");
  const owner = people("wes");
  let p = await owner.save("g-ret", "r", withBody("v1"), 0, "w1");
  for (let i = 2; i <= 5; i++)
    p = await owner.save("g-ret", "r", withBody(`v${i}`), p.revision, `w${i}`);
  const proposal = await owner.propose("g-ret", {
    productionId: "r",
    itemId: p.data.items[0].id,
    baseHash: await digest("v5"),
    instruction: "x",
    replacement: { body: "v6" },
    idempotencyKey: "w6",
  });
  await repo.rejectChange("g-ret", proposal.id, "wes");
  await repo.hit("writes:wes", 1);
  await withLimit(RETENTION, "revisionsPerProduction", 2 as never, async () => {
    const purged = await repo.purge();
    assert.equal(purged.revisions, 3);
    assert.ok(purged.rateLimits >= 1);
  });
  const kept = await db
    .prepare(
      "SELECT revision FROM revisions WHERE workspace_id='g-ret' ORDER BY revision",
    )
    .all<{ revision: number }>();
  assert.deepEqual(
    kept.results.map((r) => r.revision),
    [4, 5],
  );

  await repo.removeUser("wes");
  const change = await repo.change("g-ret", proposal.id);
  assert.equal(change.createdBy, "deleted-user");
  assert.equal(
    (
      await scalar<{ d: string }>(
        "SELECT decided_by AS d FROM changes WHERE id=?",
        proposal.id,
      )
    ).d,
    "deleted-user",
  );

  // The sole owner's workspace is soft-deleted; after the grace period it is
  // erased. A zero time budget does nothing; a later run finishes the job.
  const later = Date.now() + (RETENTION.workspaceGraceDays + 1) * 86_400_000;
  const none = await repo.purge(later, 2000, 0);
  assert.equal(none.workspaces, 0);
  assert.ok(await scalar("SELECT 1 AS x FROM workspaces WHERE id='g-ret'"));
  const done = await repo.purge(later);
  assert.ok(done.workspaces >= 1);
  assert.equal(
    await db.prepare("SELECT 1 AS x FROM workspaces WHERE id='g-ret'").first(),
    null,
  );
  assert.equal(
    (
      await scalar<{ n: number }>(
        "SELECT COUNT(*) AS n FROM productions WHERE workspace_id='g-ret'",
      )
    ).n,
    0,
  );
});
