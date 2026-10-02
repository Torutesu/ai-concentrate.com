import { build } from "esbuild";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
const dir = await mkdtemp(path.resolve(".test-"));
try {
  const output = path.join(dir, "service.test.mjs");
  await build({
    entryPoints: ["tests/service.test.ts"],
    outfile: output,
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
  });
  for (const database of ["d1", "libsql"]) {
    console.log(`Database contract: ${database}`);
    const result = spawnSync(process.execPath, ["--test", output], {
      stdio: "inherit",
      env: { ...process.env, TEST_DATABASE: database },
    });
    if (result.status !== 0) {
      process.exitCode = result.status ?? 1;
      break;
    }
  }
} finally {
  await rm(dir, { recursive: true, force: true });
}
