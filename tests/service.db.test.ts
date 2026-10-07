import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import type { Database } from "../lib/platform/database";
import { Repository } from "../lib/server/repository";
import { StudioService } from "../lib/server/service";
import { generateProposal } from "../lib/server/generation";
import { executeOperation } from "../lib/server/operations";
import { newProduction } from "../lib/domain/seed";
import { digest } from "../lib/domain/hash";
import { LIMITS } from "../lib/domain/limits";
import type { Production } from "../lib/domain/models";
import { agent, createDatabase, fakeAi, human, replaceWith } from "./helpers";

let db: Database,
  close: () => Promise<void>,
  repo: Repository,
  owner: StudioService,
  other: StudioService,
  viewer: StudioService,
  editor: StudioService,
  bot: StudioService;
const ai = fakeAi(() => replaceWith("Generated text"));
const ctx = (service: StudioService, config = ai.config) => ({
  service,
  ai: () => config,
});
const rows = async <T>(sql: string, ...args: unknown[]) =>
  (
    await db
      .prepare(sql)
      .bind(...args)
      .all<T>()
  ).results;
const revise = (
  service: StudioService,
  workspaceId: string,
  productionId: string,
  itemId: string,
  baseRevision: number,
  key: string,
  config = ai.config,
) =>
  generateProposal(service, config, workspaceId, {
    productionId,
    itemId,
    baseRevision,
    instruction: "Rewrite",
    idempotencyKey: key,
  });
const twoItems = (title = "Two items"): Production => {
  const data = newProduction(title);
  data.items.push({
    ...data.items[0],
    id: "second",
    title: "X",
    kind: "x",
    body: "Keep me",
  });
  return data;
};

before(async () => {
  ({ db, close } = await createDatabase());
  repo = new Repository(db);
  await repo.create("alice", "A", "wa");
  await repo.create("bob", "B", "wb");
  await db
    .prepare(
      "INSERT INTO memberships(workspace_id,user_id,role) VALUES('wa','read-only','viewer'),('wa','ed','editor')",
    )
    .run();
  owner = new StudioService(repo, human("alice"));
  other = new StudioService(repo, human("bob"));
  viewer = new StudioService(repo, human("read-only"));
  editor = new StudioService(repo, human("ed"));
  bot = new StudioService(repo, agent("alice"));
});
after(() => close());

test("tenant and role isolation applies to reads and writes", async () => {
  await assert.rejects(other.page("wa"), { code: "NOT_FOUND" });
  await assert.rejects(
    viewer.save("wa", "forbidden", newProduction(), 0, "nope"),
    {
      code: "FORBIDDEN",
    },
  );
  assert.equal((await viewer.page("wa")).items.length, 0);
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
  assert.equal((await repo.get("wa", "race"))?.revision, 2);
  assert.equal((await repo.historyPage("wa", "race", 10)).items.length, 2);
});

test("retried commands replay from a slim receipt; changed input is rejected", async () => {
  const data = newProduction("Retry");
  const values = await Promise.all([
    owner.save("wa", "retry", data, 0, "retry-key"),
    owner.save("wa", "retry", data, 0, "retry-key"),
  ]);
  assert.deepEqual(values[0], values[1]);
  assert.equal((await repo.historyPage("wa", "retry", 10)).items.length, 1);
  await assert.rejects(
    owner.save("wa", "retry", { ...data, title: "Changed" }, 0, "retry-key"),
    {
      code: "IDEMPOTENCY_MISMATCH",
    },
  );
  const [receipt] = await rows<{ result: string }>(
    "SELECT result FROM commands WHERE workspace_id='wa' AND key='retry-key'",
  );
  assert.deepEqual(JSON.parse(receipt.result), {
    productionId: "retry",
    revision: 1,
  });
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

test("generation is an idempotent, scoped proposal; applying changes only the target", async () => {
  const data = twoItems();
  await owner.save("wa", "generate", data, 0, "gen-create");
  const before = ai.requests.length;
  const c = await revise(owner, "wa", "generate", "draft-ja", 1, "gen-request");
  assert.equal((await repo.get("wa", "generate"))?.data.items[0].body, "");
  assert.equal(
    (await revise(owner, "wa", "generate", "draft-ja", 1, "gen-request")).id,
    c.id,
  );
  assert.equal(ai.requests.length - before, 1);
  assert.equal(c.status, "proposed");
  assert.equal(c.origin?.kind, "server_ai");
  assert.equal(c.beforeHash, await digest(""));
  await assert.rejects(other.apply("wb", c.id), { code: "NOT_FOUND" });
  const applied = await owner.apply("wa", c.id);
  assert.equal(applied.data.items[0].body, "Generated text");
  assert.equal(applied.data.items[1].body, "Keep me");
  assert.deepEqual(await owner.apply("wa", c.id), applied);
  assert.equal((await repo.change("wa", c.id)).status, "applied");
  const [run] = await rows<{
    status: string;
    input_tokens: number;
    cost_micros: number;
  }>(
    "SELECT status,input_tokens,cost_micros FROM ai_runs WHERE workspace_id='wa' ORDER BY created_at DESC LIMIT 1",
  );
  assert.deepEqual(run, {
    status: "succeeded",
    input_tokens: 100,
    cost_micros: 140,
  });
});

test("a proposal survives edits to other items and goes stale when its target changes", async () => {
  const p = await owner.save("wa", "three-way", twoItems(), 0, "tw-create");
  const first = await revise(owner, "wa", "three-way", "draft-ja", 1, "tw-a");
  const second = await revise(owner, "wa", "three-way", "second", 1, "tw-b");
  const data = structuredClone(p.data);
  data.items[1].body = "Human edit of the second item";
  await owner.save("wa", "three-way", data, 1, "tw-human");
  assert.equal((await repo.change("wa", second.id)).status, "stale");
  assert.equal((await repo.change("wa", first.id)).status, "proposed");
  const applied = await owner.apply("wa", first.id);
  assert.equal(applied.revision, 3);
  assert.equal(applied.data.items[1].body, "Human edit of the second item");
  await assert.rejects(owner.apply("wa", second.id), { code: "CHANGE_CLOSED" });
});

test("stale proposal does not overwrite a later human edit", async () => {
  const p = await owner.save("wa", "stale", newProduction(), 0, "stale-create");
  const c = await revise(owner, "wa", "stale", "draft-ja", 1, "stale-gen");
  const data = structuredClone(p.data);
  data.items[0].body = "Human";
  await owner.save("wa", "stale", data, 1, "human-change");
  await assert.rejects(owner.apply("wa", c.id), { code: "CHANGE_CLOSED" });
  assert.equal((await repo.get("wa", "stale"))?.data.items[0].body, "Human");
});

test("the provider receives the brief, channel guidance and only this workspace's relevant sources", async () => {
  const data = newProduction("仕事の再開を早くする");
  data.persona = "複数案件のプロジェクトマネージャー";
  data.problem = "会議の前に判断の理由を探し直している";
  data.metric = "初回の価値体験";
  data.items[0].kind = "x";
  await owner.save("wa", "brief-test", data, 0, "brief-create");
  await other.addSource("wb", {
    name: "Private",
    kind: "markdown",
    reference: "",
    body: "Never leak this 判断の理由",
  });
  await owner.addSource("wa", {
    name: "Product",
    kind: "markdown",
    reference: "",
    body: "ShogunAIは判断の理由を記録し、会議の前に探し直す時間を減らします。連絡先 founder@example.com",
  });
  const local = fakeAi(() => replaceWith("Scoped draft"));
  await revise(
    owner,
    "wa",
    "brief-test",
    "draft-ja",
    1,
    "brief-generation",
    local.config,
  );
  const [request] = local.requests;
  assert.match(request.parts.task, /Channel guidance \(x\)/);
  assert.match(
    request.parts.task,
    /persona: 複数案件のプロジェクトマネージャー/,
  );
  assert.match(request.parts.task, /metric: 初回の価値体験/);
  assert.doesNotMatch(
    request.parts.task,
    /hypothesis:/,
    "empty brief fields are omitted",
  );
  assert.match(request.parts.context, /判断の理由を記録/);
  assert.doesNotMatch(request.parts.context, /Never leak this/);
  assert.doesNotMatch(
    request.parts.context,
    /founder@example\.com/,
    "contact data is redacted",
  );
  assert.match(request.parts.context, /\[REDACTED:email\]/);
  assert.ok(
    !request.parts.system.includes("仕事の再開"),
    "system prompt stays workspace-independent",
  );
  assert.equal(request.schemaName, "revision");
  assert.equal(request.cacheKey.startsWith("ws:wa:"), true);
});

test("the context block is identical across instructions, so the prefix can be cached", async () => {
  const local = fakeAi(() => replaceWith("v"));
  await revise(
    owner,
    "wa",
    "brief-test",
    "draft-ja",
    1,
    "cache-1",
    local.config,
  );
  await generateProposal(owner, local.config, "wa", {
    productionId: "brief-test",
    itemId: "draft-ja",
    baseRevision: 1,
    instruction: "Make it shorter",
    idempotencyKey: "cache-2",
  });
  const [a, b] = local.requests;
  assert.equal(a.parts.system, b.parts.system);
  assert.equal(a.parts.context, b.parts.context);
  assert.equal(a.cacheKey, b.cacheKey);
  assert.notEqual(a.parts.task, b.parts.task);
});

test("sources excluded from AI or a policy of sendSources=none never reach the provider", async () => {
  await repo.create("alice", "Policy", "policy");
  const p = await owner.save(
    "policy",
    "p",
    newProduction("判断の理由を残す"),
    0,
    "policy-create",
  );
  const s = await owner.addSource("policy", {
    name: "Secret plan",
    kind: "markdown",
    reference: "",
    body: "判断の理由を残す極秘の計画",
  });
  await owner.updateSource("policy", s.id, true);
  const local = fakeAi(() => replaceWith("x"));
  await revise(
    owner,
    "policy",
    "p",
    "draft-ja",
    p.revision,
    "excluded",
    local.config,
  );
  assert.doesNotMatch(local.requests[0].parts.context, /極秘/);
  await owner.updateSource("policy", s.id, false);
  const settings = await owner.settings("policy");
  await owner.updateSettings("policy", settings.revision, {
    policy: { sendSources: "none" },
  });
  await revise(
    owner,
    "policy",
    "p",
    "draft-ja",
    p.revision,
    "none",
    local.config,
  );
  assert.doesNotMatch(local.requests[1].parts.context, /極秘/);
});

test("AI output that would exceed the aggregate budget is not stored", async () => {
  const data = newProduction("Budget");
  for (let i = 1; i < 12; i++)
    data.items.push({ ...data.items[0], id: `i${i}`, body: "" });
  let p = await owner.save("wa", "budget", data, 0, "budget-create");
  const long = "月曜の朝、仕事を再開する。".repeat(1300).slice(0, 15_000);
  const local = fakeAi(() => replaceWith(long));
  await assert.rejects(
    (async () => {
      for (const item of data.items) {
        const c = await revise(
          owner,
          "wa",
          "budget",
          item.id,
          p.revision,
          `budget-${item.id}`,
          local.config,
        );
        p = await owner.apply("wa", c.id);
      }
    })(),
    { code: "AGGREGATE_TOO_LARGE" },
  );
  const stored = (await repo.get("wa", "budget"))!;
  assert.ok(
    new TextEncoder().encode(JSON.stringify(stored.data)).byteLength <=
      LIMITS.aggregateBytes,
  );
  // Whatever was stored can still be saved through the HTTP-sized limit.
  assert.ok(
    new TextEncoder().encode(
      JSON.stringify({
        data: stored.data,
        baseRevision: 1,
        idempotencyKey: "k",
      }),
    ).byteLength < LIMITS.requestBytes,
  );
  assert.equal(
    (
      await owner.save(
        "wa",
        "budget",
        stored.data,
        stored.revision,
        "budget-resave",
      )
    ).revision,
    stored.revision + 1,
  );
});

test("item_patch edits one item against its hash, independent of other edits", async () => {
  const p = await owner.save("wa", "patch", twoItems(), 0, "patch-create");
  const hash = await digest("Keep me");
  const data = structuredClone(p.data);
  data.title = "Renamed meanwhile";
  await owner.save("wa", "patch", data, 1, "patch-other");
  const patched = await bot.patchItem(
    "wa",
    "patch",
    "second",
    hash,
    { edits: [{ find: "Keep", replace: "Kept" }] },
    "patch-1",
  );
  assert.equal(patched.revision, 3);
  assert.equal(patched.item?.hash, await digest("Kept me"));
  assert.deepEqual(
    await bot.patchItem(
      "wa",
      "patch",
      "second",
      hash,
      { edits: [{ find: "Keep", replace: "Kept" }] },
      "patch-1",
    ),
    patched,
  );
  await assert.rejects(
    bot.patchItem("wa", "patch", "second", hash, { body: "x" }, "patch-2"),
    { code: "CONFLICT" },
  );
  await assert.rejects(
    bot.patchItem(
      "wa",
      "patch",
      "second",
      patched.item!.hash,
      { edits: [{ find: "absent", replace: "x" }] },
      "patch-3",
    ),
    { code: "EDIT_NOT_FOUND" },
  );
  const brief = await bot.patchBrief(
    "wa",
    "patch",
    3,
    { persona: "Founders" },
    "brief-1",
  );
  assert.equal(brief.revision, 4);
  assert.equal((await repo.get("wa", "patch"))?.data.persona, "Founders");
});

test("agents propose with their own model; people decide unless the policy allows agents", async () => {
  const p = await owner.save("wa", "agent", twoItems(), 0, "agent-create");
  const input = {
    productionId: "agent",
    itemId: "second",
    baseHash: await digest("Keep me"),
    instruction: "Tighten",
    replacement: { body: "Tight copy with 47% growth" },
    declaredModel: "client-model",
    idempotencyKey: "propose-1",
  };
  const summary = await bot.propose("wa", input);
  assert.deepEqual(
    await bot.propose("wa", input),
    summary,
    "replay returns the same proposal",
  );
  await assert.rejects(bot.propose("wa", { ...input, instruction: "Other" }), {
    code: "IDEMPOTENCY_MISMATCH",
  });
  assert.equal(summary.originKind, "client_agent");
  assert.deepEqual(summary.warnings, ["figure:47%"]);
  await assert.rejects(bot.apply("wa", summary.id), {
    code: "FORBIDDEN_SCOPE",
  });
  const settings = await owner.settings("wa");
  await assert.rejects(
    editor.updateSettings("wa", settings.revision, {
      policy: { agentApply: "any" },
    }),
    { code: "FORBIDDEN" },
  );
  await owner.updateSettings("wa", settings.revision, {
    policy: { agentApply: "own_proposals" },
  });
  const otherClient = new StudioService(repo, agent("alice", "client-2"));
  await assert.rejects(otherClient.apply("wa", summary.id), {
    code: "FORBIDDEN_SCOPE",
  });
  const applied = await bot.apply("wa", summary.id);
  assert.equal(applied.data.items[1].body, "Tight copy with 47% growth");
  assert.equal(p.revision + 1, applied.revision);
  const current = await owner.settings("wa");
  await owner.updateSettings("wa", current.revision, {
    policy: { agentApply: "never" },
  });
});

test("rejected proposals cannot be applied", async () => {
  await owner.save("wa", "reject", newProduction(), 0, "reject-create");
  const c = await revise(owner, "wa", "reject", "draft-ja", 1, "reject-gen");
  assert.equal((await owner.reject("wa", c.id)).status, "rejected");
  assert.equal(
    (await owner.reject("wa", c.id)).status,
    "rejected",
    "idempotent",
  );
  await assert.rejects(owner.apply("wa", c.id), { code: "CHANGE_CLOSED" });
  const open = await owner.changes(
    "wa",
    { productionId: "reject", status: "proposed", limit: 10 },
    false,
  );
  assert.equal(open.items.length, 0);
});

test("source listing carries previews only; text is read in ranges and searched", async () => {
  await repo.create("alice", "Sources", "src");
  const body =
    "第一段落。製品は判断の理由を記録します。\n\n".repeat(80) +
    "末尾の固有表現XYZZY";
  const added = await owner.addSource("src", {
    name: "Long",
    kind: "markdown",
    reference: "https://example.test",
    body,
  });
  assert.equal(added.truncated, true);
  assert.deepEqual(added.sensitive, []);
  const list = await owner.sources("src");
  assert.equal(list.items.length, 1);
  assert.ok(!("body" in list.items[0]));
  assert.ok(list.items[0].preview.length <= LIMITS.previewChars);
  const part = await owner.source("src", added.id, 0, 100);
  assert.equal(part.text.length, 100);
  assert.equal(part.nextOffset, 100);
  const hits = await owner.searchSources("src", "XYZZY", 5);
  assert.equal(hits.results[0].sourceId, added.id);
  const secret = await owner.addSource("src", {
    name: "Keys",
    kind: "markdown",
    reference: "",
    body: "token sk-proj-abcdefghijklmnopqrstuvwxyz012345",
  });
  assert.deepEqual(secret.sensitive, ["api_key"]);
  // Excluding a source keeps it out of AI and agent search, not the owner's.
  await owner.updateSource("src", added.id, true);
  assert.equal(
    (await owner.searchSources("src", "XYZZY", 5)).results[0].sourceId,
    added.id,
  );
  const bot = new StudioService(repo, agent("alice"));
  assert.equal((await bot.searchSources("src", "XYZZY", 5)).results.length, 0);
  await owner.updateSource("src", added.id, false);
  assert.equal((await bot.searchSources("src", "XYZZY", 5)).results.length, 1);
  await owner.deleteSource("src", added.id);
  assert.equal(
    (await owner.searchSources("src", "XYZZY", 5)).results.length,
    0,
  );
  assert.equal(
    (await rows("SELECT id FROM source_chunks WHERE source_id=?", added.id))
      .length,
    0,
  );
  await assert.rejects(other.deleteSource("src", secret.id), {
    code: "NOT_FOUND",
  });
});

test("legacy sources without chunks are chunked lazily on first AI use", async () => {
  await repo.create("alice", "Legacy", "legacy");
  await db
    .prepare(
      "INSERT INTO sources(id,workspace_id,name,kind,reference,body,hash,created_at) VALUES('old','legacy','Old','markdown','','旧資料：判断の理由を残す','h','2026-01-01')",
    )
    .run();
  const p = await owner.save(
    "legacy",
    "p",
    newProduction("判断の理由を残す"),
    0,
    "legacy-create",
  );
  const local = fakeAi(() => replaceWith("x"));
  await revise(
    owner,
    "legacy",
    "p",
    "draft-ja",
    p.revision,
    "legacy-gen",
    local.config,
  );
  assert.match(local.requests[0].parts.context, /旧資料/);
  assert.equal(
    (
      await rows<{ chunk_count: number }>(
        "SELECT chunk_count FROM sources WHERE id='old'",
      )
    )[0].chunk_count,
    1,
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
      assert.equal(item.itemCount, 1);
      seen.add(item.id);
    }
    cursor = page.nextCursor ?? undefined;
  } while (cursor);
  assert.equal(seen.size, 5);
  await assert.rejects(other.page("pages", 2), { code: "NOT_FOUND" });
  await assert.rejects(owner.page("pages", 2, "broken"), { code: "CURSOR" });
});

test("search uses the index for 3+ characters, substring match for shorter, per tenant", async () => {
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
      query,
    );
    assert.equal(page.nextCursor, null);
  }
  assert.equal(
    (await owner.page("search", 1, undefined, "absent")).items.length,
    0,
  );
  // Edits re-index only what changed: the old phrase disappears, the new one is found.
  const edited = structuredClone(data);
  edited.items[0].body = "新しい本文";
  await owner.save("search", "find", edited, 1, "search-edit");
  assert.equal(
    (await owner.page("search", 5, undefined, "本文だけ")).items.length,
    0,
  );
  assert.equal(
    (await owner.page("search", 5, undefined, "新しい本文")).items.length,
    1,
  );
  assert.equal(
    (
      await rows(
        "SELECT id FROM search_docs WHERE production_id='find' AND workspace_id='search'",
      )
    ).length,
    2,
  );
  await assert.rejects(
    executeOperation(ctx(other), "production_list", {
      workspaceId: "search",
      query: "本文",
    }),
    { code: "NOT_FOUND" },
  );
  await assert.rejects(
    executeOperation(ctx(owner), "production_list", {
      workspaceId: "search",
      query: "a".repeat(201),
    }),
  );
});

test("history pages retain all revisions and snapshots are read-only and tenant-scoped", async () => {
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
  assert.equal(
    (await viewer.snapshot("wa", "long-history", 1)).data.title,
    "Revision 1",
  );
  await assert.rejects(other.snapshot("wa", "long-history", 1), {
    code: "NOT_FOUND",
  });
  await assert.rejects(owner.snapshot("wa", "long-history", 999), {
    code: "NOT_FOUND",
  });
  await assert.rejects(
    executeOperation(ctx(owner), "production_history", {
      workspaceId: "wa",
      productionId: "long-history",
      limit: 1000,
    }),
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

test("production_get returns metadata by default and bodies only on request", async () => {
  const detail = (await executeOperation(ctx(bot), "production_get", {
    workspaceId: "wa",
    productionId: "patch",
  })) as {
    production: {
      data: { items: { body?: string; hash: string; chars: number }[] };
    };
  };
  assert.ok(
    detail.production.data.items.every(
      (i) => i.body === undefined && i.hash.length === 64,
    ),
  );
  const item = (await executeOperation(ctx(bot), "item_get", {
    workspaceId: "wa",
    productionId: "patch",
    itemId: "second",
  })) as {
    text: string;
  };
  assert.equal(item.text, "Kept me");
});

test("review reports missing inputs without claiming correctness", async () => {
  const report = (await executeOperation(ctx(owner), "production_review", {
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

test("the monthly token budget stops generation before any provider call", async () => {
  await repo.create("alice", "Budgeted", "budgeted");
  const p = await owner.save(
    "budgeted",
    "p",
    newProduction(),
    0,
    "budgeted-create",
  );
  const tight = fakeAi(() => replaceWith("x"), { monthlyTokenBudget: 1 });
  await assert.rejects(
    revise(
      owner,
      "budgeted",
      "p",
      "draft-ja",
      p.revision,
      "over",
      tight.config,
    ),
    { code: "AI_BUDGET" },
  );
  assert.equal(tight.requests.length, 0);
  assert.equal(
    (
      await rows(
        "SELECT key FROM generation_requests WHERE workspace_id='budgeted'",
      )
    ).length,
    0,
  );
  const usage = (await executeOperation(ctx(owner), "usage_get", {
    workspaceId: "wa",
  })) as {
    you: { billableTokens: number };
    workspace: { runs: number };
  };
  assert.ok(usage.you.billableTokens > 0 && usage.workspace.runs > 0);
});

test("scopes and audit: agents cannot delete; mutations and denials are audited", async () => {
  await assert.rejects(
    executeOperation(ctx(bot), "production_delete", {
      workspaceId: "wa",
      productionId: "retry",
    }),
    { code: "FORBIDDEN_SCOPE" },
  );
  await executeOperation(ctx(owner), "production_delete", {
    workspaceId: "wa",
    productionId: "retry",
  });
  assert.equal(await repo.get("wa", "retry"), null);
  assert.equal(
    (await rows("SELECT revision FROM revisions WHERE production_id='retry'"))
      .length,
    0,
  );
  const events = await rows<{
    operation: string;
    outcome: string;
    channel: string;
    actor_id: string;
  }>(
    "SELECT operation,outcome,channel,actor_id FROM audit_events WHERE target_id='retry' ORDER BY rowid",
  );
  assert.deepEqual(
    events.map((e) => [e.operation, e.outcome, e.channel]),
    [
      ["production_delete", "denied", "mcp"],
      ["production_delete", "succeeded", "web"],
    ],
  );
});

test("workspace quota, deletion grace period and retention purge", async () => {
  const quota = new StudioService(repo, human("quota-user"));
  for (let i = 0; i < LIMITS.workspacesPerOwner; i++)
    await quota.createWorkspace(`q${i}`, `Q${i}`);
  await assert.rejects(quota.createWorkspace("q-over", "Over"), {
    code: "WORKSPACE_LIMIT",
  });
  assert.equal(
    (await quota.createWorkspace("q0", "Q0 again")).id,
    "q0",
    "same ID replays",
  );

  await quota.save("q1", "p", newProduction(), 0, "q1-create");
  await assert.rejects(
    new StudioService(repo, human("ed")).deleteWorkspace("q1"),
    { code: "NOT_FOUND" },
  );
  assert.deepEqual(await quota.deleteWorkspace("q1"), {
    deleted: true,
    purgeAfterDays: 30,
  });
  await assert.rejects(quota.page("q1"), { code: "NOT_FOUND" });
  assert.ok(!(await quota.workspaces()).some((w) => w.id === "q1"));
  assert.equal(
    (await repo.purge(Date.now())).workspaces,
    0,
    "inside grace period",
  );
  const purged = await repo.purge(Date.now() + 31 * 86_400_000);
  assert.equal(purged.workspaces, 1);
  assert.ok(purged.commands > 0, "receipts older than 7 days are removed");
  for (const table of [
    "productions",
    "revisions",
    "search_docs",
    "memberships",
  ])
    assert.equal(
      (await rows(`SELECT 1 FROM ${table} WHERE workspace_id='q1'`)).length,
      0,
      table,
    );
});

test("account deletion removes access and pseudonymizes history", async () => {
  const leaver = new StudioService(repo, human("leaver"));
  await leaver.createWorkspace("leaver-ws", "Leaver");
  await leaver.save("leaver-ws", "p", newProduction(), 0, "leaver-create");
  await repo.removeUser("leaver");
  assert.deepEqual(await leaver.workspaces(), []);
  assert.equal(
    (await rows("SELECT 1 FROM revisions WHERE actor_id='leaver'")).length,
    0,
  );
  assert.equal(
    (
      await rows<{ d: string | null }>(
        "SELECT deleted_at AS d FROM workspaces WHERE id='leaver-ws'",
      )
    )[0].d !== null,
    true,
  );
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
  assert.equal(productionWorkflow(p, 1).complete, false);
  p.decision =
    "Measured 3 activated users. Revise the opening and run another test.";
  assert.equal(productionWorkflow(p, 1).complete, true);
});
