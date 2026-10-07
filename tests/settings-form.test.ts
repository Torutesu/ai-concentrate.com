import { test } from "node:test";
import assert from "node:assert/strict";
import { profileSchema } from "../lib/domain/settings";
import {
  cacheRate,
  draftToProfile,
  formatUsd,
  profileToDraft,
  sameProfile,
} from "../lib/ui/settings-form";

test("brand profile form round-trips and normalizes what people type", () => {
  const profile = profileSchema.parse({
    voice: "率直で短く",
    glossary: [{ term: "ShogunAI", preferred: "ShogunAI", avoid: ["将軍AI"] }],
    prohibitedClaims: ["業界No.1"],
  });
  assert.ok(sameProfile(draftToProfile(profileToDraft(profile)), profile));
  const typed = draftToProfile({
    voice: "  丁寧  ",
    glossary: [
      { term: " AI ", preferred: "AI", avoid: "人工知能、 A.I. ,人工知能" },
      { term: "", preferred: "ignored", avoid: "" },
      { term: "AI", preferred: "duplicate", avoid: "" },
    ],
    claims: "必ず儲かる\n\n 業界No.1 \n必ず儲かる",
  });
  assert.deepEqual(typed, {
    voice: "丁寧",
    glossary: [{ term: "AI", preferred: "AI", avoid: ["人工知能", "A.I."] }],
    prohibitedClaims: ["必ず儲かる", "業界No.1"],
  });
  // What the form produces is always accepted by the server schema.
  assert.deepEqual(profileSchema.parse(typed), typed);
});

test("usage formatting stays readable for tiny and empty values", () => {
  assert.equal(cacheRate(0, 0), 0);
  assert.equal(cacheRate(1000, 700), 70);
  assert.equal(formatUsd(0, "en"), "$0.00");
  assert.equal(formatUsd(1234, "en"), "$0.0012");
  assert.equal(formatUsd(2_500_000, "en"), "$2.50");
});
