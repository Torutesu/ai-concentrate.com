import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import path from "node:path";

// *.db.test.ts run once per database adapter (Miniflare D1 and libSQL);
// other tests are database-independent and run once.
const dir = await mkdtemp(path.resolve(".test-"));
try {
  const entries = (await readdir("tests")).filter((f) =>
    f.endsWith(".test.ts"),
  );
  await build({
    entryPoints: entries.map((f) => `tests/${f}`),
    outdir: dir,
    outExtension: { ".js": ".mjs" },
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    logLevel: "warning",
  });
  const out = (f) => path.join(dir, f.replace(/\.ts$/, ".mjs"));
  const runs = [
    {
      name: "unit",
      files: entries.filter((f) => !f.endsWith(".db.test.ts")),
      env: {},
    },
    ...["d1", "libsql"].map((database) => ({
      name: `database contract: ${database}`,
      files: entries.filter((f) => f.endsWith(".db.test.ts")),
      env: { TEST_DATABASE: database },
    })),
  ];
  for (const run of runs) {
    if (!run.files.length) continue;
    console.log(`\n# ${run.name}`);
    const result = spawnSync(
      process.execPath,
      ["--test", ...run.files.map(out)],
      {
        stdio: "inherit",
        env: { ...process.env, ...run.env },
      },
    );
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
