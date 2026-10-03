import { z } from "zod";
import { body, run } from "../../../../lib/server/http";
import { executeOperation } from "../../../../lib/server/operations";
/** Generic operation gateway (same registry as MCP and the CLI). */
export async function POST(r: Request) {
  return run(r, true, async (ctx) => {
    const p = await body(
      r,
      z.object({ name: z.string(), arguments: z.unknown() }).strict(),
    );
    return { data: await executeOperation(ctx, p.name, p.arguments ?? {}) };
  });
}
