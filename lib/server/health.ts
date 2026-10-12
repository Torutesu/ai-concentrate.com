import { is } from "drizzle-orm";
import { getTableConfig, SQLiteTable } from "drizzle-orm/sqlite-core";
import * as schema from "../../db/schema";
import type { Database } from "../platform/database";

/** Every table and column the code expects, derived from db/schema.ts. */
export const expectedColumns: Record<string, string[]> = Object.fromEntries(
  Object.values(schema as Record<string, unknown>)
    .filter((value): value is SQLiteTable => is(value, SQLiteTable))
    .map((table) => {
      const config = getTableConfig(table);
      return [config.name, config.columns.map((c) => c.name)];
    }),
);

export type Health =
  | { status: "ok" }
  | { status: "unavailable"; reason: "database" | "schema"; missing?: string };

const quote = (name: string) => `"${name.replaceAll('"', '""')}"`;
/**
 * One statement that names every expected column (LIMIT 0 reads no rows).
 * Portable across D1 and libSQL: D1 forbids pragma table functions.
 */
const PROBE =
  "SELECT " +
  Object.entries(expectedColumns)
    .map(
      ([table, columns]) =>
        `(SELECT COUNT(*) FROM (SELECT ${columns.map(quote).join(",")} FROM ${quote(table)} LIMIT 0))`,
    )
    .join("+") +
  " AS n";

/**
 * Readiness: the database answers and has every table/column the deployed
 * code uses, so a deploy that ran before its migration fails here instead of
 * on a user's request. Reveals no data.
 */
export async function checkHealth(db: Database): Promise<Health> {
  try {
    await db.prepare(PROBE).first();
    return { status: "ok" };
  } catch (e) {
    const match = /no such (?:table|column): ([\w."]+)/i.exec(String(e));
    return match
      ? { status: "unavailable", reason: "schema", missing: match[1] }
      : { status: "unavailable", reason: "database" };
  }
}
