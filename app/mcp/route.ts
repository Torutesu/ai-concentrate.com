import { z } from "zod";
import {
  body,
  errorResponse,
  operationContext,
  requestIdOf,
} from "../../lib/server/http";
import { dispatchMcp, validateMcpRequest } from "../../lib/server/mcp";
import { executeOperation } from "../../lib/server/operations";

/** Stateless Streamable HTTP MCP endpoint (JSON responses, no SSE stream). */
export async function POST(r: Request) {
  const requestId = requestIdOf(r);
  try {
    validateMcpRequest(r);
    // Authenticate before reading the body so clients get the OAuth challenge.
    const ctx = await operationContext(r, requestId, true);
    const input = await body(r, z.unknown());
    const result = await dispatchMcp(input, (name, args) =>
      executeOperation(ctx, name, args),
    );
    if (result === null) return new Response(null, { status: 202 });
    return Response.json(result, {
      headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    });
  } catch (e) {
    return errorResponse(e, requestId, r);
  }
}
export async function GET(r: Request) {
  try {
    validateMcpRequest(r);
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  } catch (e) {
    return errorResponse(e, requestIdOf(r), r);
  }
}
