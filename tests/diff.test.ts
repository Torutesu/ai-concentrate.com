import { test } from "node:test";
import assert from "node:assert/strict";
import { diffStats, diffText, type DiffPart } from "../lib/domain/diff";

const rebuild = (parts: DiffPart[], side: "before" | "after") =>
  parts
    .filter(
      (p) =>
        p.type === "same" || p.type === (side === "before" ? "del" : "add"),
    )
    .map((p) => p.text)
    .join("");

test("diff reconstructs both sides and marks only the changed words", () => {
  const before = "Ship the weekly report every Monday morning.";
  const after = "Ship the weekly summary every Monday.";
  const parts = diffText(before, after);
  assert.equal(rebuild(parts, "before"), before);
  assert.equal(rebuild(parts, "after"), after);
  assert.deepEqual(
    parts.filter((p) => p.type !== "same").map((p) => [p.type, p.text.trim()]),
    [
      ["del", "report"],
      ["add", "summary"],
      ["del", "morning"],
    ],
  );
});

test("CJK text is compared per character and never splits a Latin word", () => {
  const parts = diffText(
    "前回の判断から再開できます",
    "前回の判断からすぐ再開できます",
  );
  assert.deepEqual(
    parts.filter((p) => p.type !== "same"),
    [{ type: "add", text: "すぐ" }],
  );
  assert.deepEqual(diffText("cat", "cats"), [
    { type: "del", text: "cat" },
    { type: "add", text: "cats" },
  ]);
});

test("identical, empty and emoji inputs stay well-formed", () => {
  assert.deepEqual(diffText("same", "same"), [{ type: "same", text: "same" }]);
  assert.deepEqual(diffText("", ""), []);
  assert.deepEqual(diffText("", "new"), [{ type: "add", text: "new" }]);
  const emoji = diffText("A👍", "A👎");
  assert.equal(rebuild(emoji, "after"), "A👎");
  for (const p of emoji)
    assert.ok(!/^[\udc00-\udfff]/.test(p.text), "no lone low surrogate");
});

test("very large rewrites degrade instead of allocating an unbounded table", () => {
  const before = Array.from({ length: 6000 }, (_, i) => `w${i}`).join(" ");
  const after = Array.from({ length: 6000 }, (_, i) => `v${i}`).join(" ");
  const started = performance.now();
  const parts = diffText(before, after);
  assert.ok(performance.now() - started < 2000);
  assert.equal(rebuild(parts, "before"), before);
  assert.equal(rebuild(parts, "after"), after);
  assert.deepEqual(diffStats(diffText("ab", "abc")), { added: 3, removed: 2 });
});
