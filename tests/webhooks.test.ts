import { test } from "node:test";
import assert from "node:assert/strict";
import { verifySvix } from "../lib/server/webhooks";

const secret = "whsec_" + btoa("test-signing-secret-32-bytes!!!!");
async function sign(id: string, timestamp: number, body: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(secret.slice(6)), (c) => c.charCodeAt(0)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(`${id}.${timestamp}.${body}`),
  );
  return btoa(String.fromCharCode(...new Uint8Array(mac)));
}

test("Svix signatures are verified, including key rotation and replay window", async () => {
  const body = JSON.stringify({ type: "user.deleted", data: { id: "user_1" } });
  const now = 1_790_000_000;
  const headers = (signature: string, ts = now) =>
    new Headers({
      "svix-id": "msg_1",
      "svix-timestamp": String(ts),
      "svix-signature": signature,
    });
  const good = await sign("msg_1", now, body);
  assert.equal(
    await verifySvix(secret, headers(`v1,${good}`), body, now),
    true,
  );
  assert.equal(
    await verifySvix(secret, headers(`v1,old v1,${good}`), body, now),
    true,
  );
  assert.equal(
    await verifySvix(secret, headers(`v1,${good}`), body + " ", now),
    false,
  );
  assert.equal(
    await verifySvix(secret, headers(`v1,${good}`), body, now + 301),
    false,
  );
  assert.equal(await verifySvix(secret, new Headers(), body, now), false);
});
