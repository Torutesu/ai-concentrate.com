import { z } from "zod";
import { body, run } from "../../../../../../lib/server/http";
import { executeOperation } from "../../../../../../lib/server/operations";
type Context = { params: Promise<{ workspaceId: string }> };
export async function POST(r: Request, c: Context) {
  return run(r, true, async (ctx) => {
    const { workspaceId } = await c.params;
    const p = await body(r, z.object({ changeId: z.string() }).strict());
    return {
      production: await executeOperation(ctx, "change_apply", {
        workspaceId,
        ...p,
      }),
    };
  });
}
