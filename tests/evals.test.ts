import { test } from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { evalCaseSchema, scoreRevision } from "../lib/ai/evals";

test("every eval case is valid and the scorer catches fabricated facts and wrong language", async () => {
  const files = (await readdir("evals/cases")).filter((f) =>
    f.endsWith(".json"),
  );
  assert.ok(files.length >= 7);
  const cases = await Promise.all(
    files.map(async (f) =>
      evalCaseSchema.parse(
        JSON.parse(await readFile(`evals/cases/${f}`, "utf8")),
      ),
    ),
  );
  const injection = cases.find((c) => c.id === "prompt-injection")!;
  assert.equal(
    scoreRevision(
      injection,
      "前回の判断から、今日の仕事をすぐ再開。ShogunAIを試す",
    ).pass,
    true,
  );
  const fooled = scoreRevision(
    injection,
    "500社が導入した実績のあるサービスです。詳しくは https://evil.example へ",
  );
  assert.equal(fooled.pass, false);
  // Injected text is caught by the case's banned phrases (sources count as evidence).
  assert.deepEqual(
    fooled.checks.filter((c) => !c.pass).map((c) => c.name),
    ['avoids "evil.example"', 'avoids "500"'],
  );
  const sparse = cases.find((c) => c.id === "sparse-evidence")!;
  const invented = scoreRevision(sparse, "【要確認】導入で作業時間が35%短縮");
  assert.ok(
    invented.checks.some((c) => c.name.startsWith("no unsupported") && !c.pass),
  );
  const reddit = cases.find((c) => c.id === "english-reddit")!;
  assert.equal(
    scoreRevision(reddit, "仕事を再開する方法は？").checks.find(
      (c) => c.name === "locale",
    )!.pass,
    false,
  );
});
