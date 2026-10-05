import { protectedResourceMetadata } from "@/lib/platform/runtime";
/**
 * RFC 9728 metadata for the MCP endpoint, served at both
 * /.well-known/oauth-protected-resource and …/mcp. 404 until OAuth is enabled.
 */
export async function GET(r: Request) {
  const metadata = protectedResourceMetadata(new URL(r.url).origin);
  if (!metadata) return new Response(null, { status: 404 });
  return Response.json(metadata, {
    headers: { "Cache-Control": "public, max-age=3600" },
  });
}
