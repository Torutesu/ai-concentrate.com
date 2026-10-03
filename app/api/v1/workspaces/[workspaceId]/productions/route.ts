import { run } from "../../../../../../lib/server/http";
import { executeOperation } from "../../../../../../lib/server/operations";
type Context = { params: Promise<{ workspaceId: string }> };
export async function GET(r: Request, c: Context) {
  return run(r, false, async (ctx) => {
    const { workspaceId } = await c.params;
    const params = new URL(r.url).searchParams;
    return executeOperation(ctx, "production_list", {
      workspaceId,
      cursor: params.get("cursor") ?? undefined,
      query: params.get("q") ?? "",
    });
  });
}
