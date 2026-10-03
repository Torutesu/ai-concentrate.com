import { after, before, test } from "node:test";
import assert from "node:assert/strict";
import { dispatchMcp, toolDefinitions } from "../lib/server/mcp";
import { executeOperation } from "../lib/server/operations";
import { Repository } from "../lib/server/repository";
import { StudioService } from "../lib/server/service";
import { operations } from "../lib/domain/operations";
import { newProduction } from "../lib/domain/seed";
import { agent, createDatabase, fakeAi, human, replaceWith } from "./helpers";

let close: () => Promise<void>,
  agentCall: (body: unknown) => Promise<unknown>,
  repo: Repository;
before(async () => {
  const created = await createDatabase();
  close = created.close;
  repo = new Repository(created.db);
  await repo.create("alice", "A", "wa");
  const owner = new StudioService(repo, human("alice"));
  await owner.save("wa", "p", newProduction("MCP"), 0, "create");
  await owner.addSource("wa", {
    name: "Doc",
    kind: "markdown",
    reference: "",
    body: "長い資料です。".repeat(8000),
  });
  const service = new StudioService(repo, agent("alice"));
  const ai = fakeAi(() => replaceWith("AI text"));
  agentCall = (body) =>
    dispatchMcp(body, (name, args) =>
      executeOperation({ service, ai: () => ai.config }, name, args),
    );
});
after(() => close());

const call = (name: string, args: unknown) =>
  agentCall({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: { name, arguments: args },
  }) as Promise<{
    result: {
      isError: boolean;
      content: { text: string }[];
      structuredContent: Record<string, unknown>;
    };
  }>;

test("tool annotations come from the operation registry", () => {
  assert.equal(toolDefinitions.length, Object.keys(operations).length);
  const byName = Object.fromEntries(
    toolDefinitions.map((t) => [t.name, t.annotations]),
  );
  assert.equal(byName.production_review.readOnlyHint, true);
  assert.equal(byName.production_delete.destructiveHint, true);
  assert.equal(byName.production_revise.openWorldHint, true);
  assert.equal(byName.item_patch.idempotentHint, true);
  assert.equal(byName.context_import.idempotentHint, false);
});

test("initialize advertises tools and prompts; prompts render the playbook", async () => {
  const init = (await agentCall({
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18" },
  })) as {
    result: { protocolVersion: string; capabilities: Record<string, unknown> };
  };
  assert.equal(init.result.protocolVersion, "2025-06-18");
  assert.ok(init.result.capabilities.prompts);
  const list = (await agentCall({
    jsonrpc: "2.0",
    id: 2,
    method: "prompts/list",
  })) as {
    result: { prompts: { name: string }[] };
  };
  assert.deepEqual(
    list.result.prompts.map((p) => p.name),
    ["revise-item", "check-claims"],
  );
  const prompt = (await agentCall({
    jsonrpc: "2.0",
    id: 3,
    method: "prompts/get",
    params: {
      name: "revise-item",
      arguments: {
        workspaceId: "wa",
        productionId: "p",
        itemId: "draft-ja",
        instruction: "短く",
      },
    },
  })) as { result: { messages: { content: { text: string } }[] } };
  assert.match(prompt.result.messages[0].content.text, /change_propose/);
  assert.match(
    prompt.result.messages[0].content.text,
    /Never invent shipped features/,
  );
  const missing = (await agentCall({
    jsonrpc: "2.0",
    id: 4,
    method: "prompts/get",
    params: { name: "revise-item", arguments: {} },
  })) as {
    error: { code: number };
  };
  assert.equal(missing.error.code, -32602);
});

test("list responses stay small: no document bodies", async () => {
  const sources = await call("context_list", { workspaceId: "wa" });
  assert.equal(sources.result.isError, false);
  assert.ok(
    sources.result.content[0].text.length < 3_000,
    "56,000-character source is not inlined",
  );
  const detail = await call("production_get", {
    workspaceId: "wa",
    productionId: "p",
  });
  assert.doesNotMatch(detail.result.content[0].text, /"body"/);
});

test("agents get actionable errors: field issues and scope denials", async () => {
  const invalid = await call("production_review", {
    workspaceId: "wa",
    productionId: "p",
    bypass: true,
  });
  assert.equal(invalid.result.isError, true);
  const error = invalid.result.structuredContent.error as {
    code: string;
    issues: { path: string }[];
  };
  assert.equal(error.code, "VALIDATION");
  assert.ok(error.issues.length > 0);
  const denied = await call("workspace_delete", { workspaceId: "wa" });
  assert.equal(
    (denied.result.structuredContent.error as { code: string }).code,
    "FORBIDDEN_SCOPE",
  );
  const unknown = (await agentCall({
    jsonrpc: "2.0",
    id: 9,
    method: "tools/call",
    params: { name: "nope", arguments: {} },
  })) as {
    error: { code: number };
  };
  assert.equal(unknown.error.code, -32602);
  assert.equal(
    await agentCall({ jsonrpc: "2.0", method: "notifications/initialized" }),
    null,
  );
});

test("server AI returns a compact summary to agents by default", async () => {
  const result = await call("production_revise", {
    workspaceId: "wa",
    productionId: "p",
    itemId: "draft-ja",
    baseRevision: 1,
    instruction: "Draft",
    idempotencyKey: "mcp-gen",
  });
  const data = result.result.structuredContent.data as Record<string, unknown>;
  assert.equal(data.status, "proposed");
  assert.equal(data.preview, "AI text");
  assert.equal("before" in data, false);
});
