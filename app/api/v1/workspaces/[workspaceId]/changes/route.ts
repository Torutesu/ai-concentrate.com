import { run } from "../../../../../../lib/server/http";
import { executeOperation } from "../../../../../../lib/server/operations";
type Context = { params: Promise<{ workspaceId: string }> };
/** Open proposals with text, for the review screen. Decided ones are not resent. */
export async function GET(r: Request, c: Context) {
  return run(r, false, async (ctx) => {
    const { workspaceId } = await c.params;
    const page = (await executeOperation(ctx, "change_list", {
      workspaceId,
      status: "proposed",
      includeText: true,
      limit: 50,
    })) as { items: unknown[] };
    return { changes: page.items };
  });
}
