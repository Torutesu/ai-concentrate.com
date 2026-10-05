const encoder = new TextEncoder();
const TOLERANCE_SECONDS = 300;

function base64ToBytes(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
function bytesToBase64(bytes: ArrayBuffer) {
  return btoa(String.fromCharCode(...new Uint8Array(bytes)));
}
/** Constant-time comparison of two base64 signatures. */
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verifies a Svix-signed webhook (used by Clerk): HMAC-SHA256 over
 * "id.timestamp.body" with the base64 secret after "whsec_", within 5 minutes.
 */
export async function verifySvix(
  secret: string,
  headers: Headers,
  payload: string,
  nowSeconds = Math.floor(Date.now() / 1000),
) {
  const id = headers.get("svix-id"),
    timestamp = headers.get("svix-timestamp"),
    signatures = headers.get("svix-signature");
  if (!id || !timestamp || !signatures) return false;
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowSeconds - ts) > TOLERANCE_SECONDS)
    return false;
  const key = await crypto.subtle.importKey(
    "raw",
    base64ToBytes(secret.replace(/^whsec_/, "")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const expected = bytesToBase64(
    await crypto.subtle.sign(
      "HMAC",
      key,
      encoder.encode(`${id}.${timestamp}.${payload}`),
    ),
  );
  return signatures
    .split(" ")
    .some((s) => s.startsWith("v1,") && equal(s.slice(3), expected));
}
