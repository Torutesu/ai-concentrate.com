// Fails when the Sites Worker bundles the Vercel runtime (Clerk/Turso) instead
// of lib/platform/sites.ts: every request would then answer 401 on Sites.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

async function* files(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* files(full);
    else if (/\.m?js$/.test(entry.name)) yield full;
  }
}
let sites = false,
  vercel = [];
for await (const file of files("dist/server")) {
  const text = await readFile(file, "utf8");
  if (text.includes("oai-authenticated-user-id")) sites = true;
  if (text.includes("TURSO_DATABASE_URL")) vercel.push(file);
}
if (!sites || vercel.length) {
  console.error(
    `Sites bundle check failed: sites runtime ${sites ? "present" : "missing"}; Vercel runtime in ${vercel.join(", ") || "none"}.`,
  );
  process.exit(1);
}
console.log("Sites bundle uses lib/platform/sites.ts.");
