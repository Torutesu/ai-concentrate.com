import { createClient } from "@libsql/client";
import { readdir, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)
  throw Error("Configure TURSO_DATABASE_URL and TURSO_AUTH_TOKEN first.");
const db = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});
try {
  await db.execute(
    "CREATE TABLE IF NOT EXISTS concentrate_migrations (name TEXT PRIMARY KEY, hash TEXT NOT NULL, applied_at TEXT NOT NULL)",
  );
  for (const file of (await readdir("drizzle"))
    .filter((n) => n.endsWith(".sql"))
    .sort()) {
    const sql = await readFile(`drizzle/${file}`, "utf8");
    const hash = createHash("sha256").update(sql).digest("hex");
    const old = await db.execute({
      sql: "SELECT hash FROM concentrate_migrations WHERE name=?",
      args: [file],
    });
    if (old.rows.length) {
      if (old.rows[0].hash !== hash)
        throw Error(`Applied migration changed: ${file}`);
      continue;
    }
    await db.batch(
      [
        ...sql
          .split("--> statement-breakpoint")
          .map((s) => s.trim())
          .filter(Boolean),
        {
          sql: "INSERT INTO concentrate_migrations(name,hash,applied_at) VALUES(?,?,?)",
          args: [file, hash, new Date().toISOString()],
        },
      ],
      "write",
    );
    console.log(`Applied ${file}`);
  }
} finally {
  db.close();
}
