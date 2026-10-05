import { readdir, readFile } from "node:fs/promises";
import { Miniflare } from "miniflare";
import { createClient } from "@libsql/client";
import { LibsqlDatabase } from "../lib/platform/libsql";
import type { Database } from "../lib/platform/database";
import { AGENT_SCOPES, HUMAN_SCOPES, type Actor } from "../lib/domain/actor";
import type { AiConfig } from "../lib/ai/config";
import type { ProviderRequest, Usage } from "../lib/ai/types";

export const dbKind = process.env.TEST_DATABASE === "libsql" ? "libsql" : "d1";

export async function migrationFiles() {
  return (await readdir("drizzle")).filter((n) => n.endsWith(".sql")).sort();
}
export const statementsOf = (sql: string) =>
  sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean);

/** Empty database of the selected kind with migrations applied (all by default). */
export async function createDatabase(upTo?: string) {
  let db: Database;
  let close: () => Promise<void>;
  if (dbKind === "libsql") {
    const client = createClient({ url: "file::memory:" });
    db = new LibsqlDatabase(client);
    close = async () => client.close();
  } else {
    const mf = new Miniflare({
      modules: true,
      script: 'export default {fetch(){return new Response("ok")}}',
      compatibilityDate: "2026-05-15",
      d1Databases: ["DB"],
    });
    db = (await mf.getD1Database("DB")) as unknown as Database;
    close = () => mf.dispose();
  }
  await applyMigrations(db, upTo);
  return { db, close };
}
export async function applyMigrations(
  db: Database,
  upTo?: string,
  from?: string,
) {
  for (const file of await migrationFiles()) {
    if (from && file < from) continue;
    for (const statement of statementsOf(
      await readFile(`drizzle/${file}`, "utf8"),
    ))
      await db.prepare(statement).run();
    if (upTo && file.startsWith(upTo)) break;
  }
}

export const human = (userId: string): Actor => ({
  userId,
  channel: "web",
  clientId: null,
  scopes: HUMAN_SCOPES,
  requestId: `req-${userId}`,
});
export const agent = (userId: string, clientId = "client-1"): Actor => ({
  userId,
  channel: "mcp",
  clientId,
  scopes: AGENT_SCOPES,
  requestId: `req-agent-${userId}`,
});

export const usage = (input = 100, output = 20, cached = 0): Usage => ({
  inputTokens: input,
  cachedInputTokens: cached,
  cacheWriteTokens: 0,
  outputTokens: output,
  reasoningTokens: 0,
});
/** AI config backed by a scripted provider; records every request it receives. */
export function fakeAi(
  respond: (request: ProviderRequest) => unknown | Promise<unknown>,
  overrides: Partial<AiConfig> = {},
) {
  const requests: ProviderRequest[] = [];
  const config: AiConfig = {
    providers: {
      fake: {
        id: "fake",
        async generate(request) {
          requests.push(request);
          return {
            output: await respond(request),
            usage: usage(),
            model: "fake-model",
          };
        },
      },
    },
    routes: {
      fast: [{ provider: "fake", model: "fake-model" }],
      standard: [{ provider: "fake", model: "fake-model" }],
    },
    prices: { "fake:fake-model": { input: 1, output: 2 } },
    monthlyTokenBudget: 1_000_000,
    contextTokens: 6_000,
    ...overrides,
  };
  return { config, requests };
}
export const replaceWith = (body: string) => ({
  mode: "replace",
  body,
  edits: [],
});
