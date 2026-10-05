import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";

// Bundles evals/run.ts (TypeScript, extensionless imports) and runs it.
const dir = await mkdtemp(path.resolve(".eval-"));
try {
  const outfile = path.join(dir, "run.mjs");
  await build({
    entryPoints: ["evals/run.ts"],
    outfile,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    logLevel: "warning",
  });
  const result = spawnSync(
    process.execPath,
    [outfile, ...process.argv.slice(2)],
    { stdio: "inherit" },
  );
  process.exitCode = result.status ?? 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
