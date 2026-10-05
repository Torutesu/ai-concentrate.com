const encoder = new TextEncoder();

export const utf8Bytes = (value: string) => encoder.encode(value).byteLength;

/** SHA-256 hex digest using Web Crypto (available in Workers and Node 22). */
export async function digest(value: string) {
  return Array.from(
    new Uint8Array(
      await crypto.subtle.digest("SHA-256", encoder.encode(value)),
    ),
  )
    .map((n) => n.toString(16).padStart(2, "0"))
    .join("");
}
