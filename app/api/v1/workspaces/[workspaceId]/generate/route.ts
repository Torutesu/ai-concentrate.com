import { body, run } from "../../../../../../lib/server/http";
import { executeOperation } from "../../../../../../lib/server/operations";
import { proposalSchema } from "../../../../../../lib/domain/models";
type Context = { params: Promise<{ workspaceId: string }> };
export async function POST(r: Request, c: Context) {
  return run(r, true, async (ctx) => {
    const { workspaceId } = await c.params;
    const p = await body(r, proposalSchema);
    return {
      change: await executeOperation(ctx, "production_revise", {
        workspaceId,
        ...p,
        includeText: true,
      }),
    };
  });
}
