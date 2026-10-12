/**
 * Response headers for every page and API response. Framing is denied on the
 * public Vercel deployment; the private Sites gateway controls its own framing.
 * Script sources are not restricted here: Clerk's hosted UI needs its own
 * origins, and a broken sign-in is worse than the marginal gain.
 */
export const BASE_SECURITY_HEADERS: [string, string][] = [
  ["X-Content-Type-Options", "nosniff"],
  ["Referrer-Policy", "strict-origin-when-cross-origin"],
  [
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  ],
];
export const FRAME_DENY_HEADERS: [string, string][] = [
  ["X-Frame-Options", "DENY"],
  [
    "Content-Security-Policy",
    "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
  ],
  ["Strict-Transport-Security", "max-age=63072000"],
];

/** Copies a response with the given headers added where not already set. */
export function withHeaders(response: Response, headers: [string, string][]) {
  // Protocol switches (e.g. WebSocket upgrades) cannot be re-wrapped.
  if (response.status < 200) return response;
  const out = new Response(response.body, response);
  for (const [name, value] of headers)
    if (!out.headers.has(name)) out.headers.set(name, value);
  return out;
}
