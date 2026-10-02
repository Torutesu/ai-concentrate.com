import { z } from "zod";
import { body, service, handle } from "../../lib/server/http";
import { dispatchMcp, validateMcpRequest } from "../../lib/server/mcp";
import { executeOperation } from "../../lib/server/operations";
import { aiProvider } from "../../lib/server/ai";
export async function POST(r: Request) {
  try {
    validateMcpRequest(r);
    const input = await body(r, z.unknown());
    const result = await dispatchMcp(input, async (name, args) =>
      executeOperation(
        await service(r, true),
        name,
        args,
        name === "production_revise" ? aiProvider() : undefined,
      ),
    );
    if (result === null) return new Response(null, { status: 202 });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    return handle(async () => {
      throw e;
    });
  }
}
export async function GET(r: Request) {
  try {
    validateMcpRequest(r);
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  } catch (e) {
    return handle(async () => {
      throw e;
    });
  }
}
