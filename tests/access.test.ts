import { test } from "node:test";
import assert from "node:assert/strict";
import { accessRules, decidedById, isAllowed } from "../lib/server/access";

test("production fails closed; previews stay open unless an allowlist is set", () => {
  const prod = accessRules({ VERCEL_ENV: "production" });
  assert.equal(prod.mode, "allowlist");
  assert.equal(isAllowed(prod, { userId: "user_a", email: "a@x.com" }), false);
  assert.equal(accessRules({ VERCEL_ENV: "preview" }).mode, "open");
  assert.equal(
    accessRules({ VERCEL_ENV: "production", ACCESS_MODE: "open" }).mode,
    "open",
  );
});

test("allowlist accepts user IDs, exact emails and @domains", () => {
  const rules = accessRules({
    ACCESS_ALLOWLIST: " user_Owner1 , boss@Example.com,@shogun.example ",
  });
  assert.equal(rules.mode, "allowlist");
  assert.ok(isAllowed(rules, { userId: "user_Owner1" }));
  assert.ok(!isAllowed(rules, { userId: "user_owner1" }), "IDs are exact");
  assert.ok(isAllowed(rules, { userId: "u2", email: "BOSS@example.com" }));
  assert.ok(isAllowed(rules, { userId: "u3", email: "kim@shogun.example" }));
  assert.ok(!isAllowed(rules, { userId: "u4", email: "kim@evil.example" }));
  assert.ok(!isAllowed(rules, { userId: "u5" }));
  assert.ok(decidedById(rules, "user_Owner1"));
  assert.ok(!decidedById(rules, "u2"), "needs the email to decide");
  assert.ok(decidedById(accessRules({ ACCESS_ALLOWLIST: "user_1" }), "u9"));
});
