import { run } from "../../../../../../../lib/server/http";
import { executeOperation } from "../../../../../../../lib/server/operations";
import { LIMITS } from "../../../../../../../lib/domain/limits";
type Context = { params: Promise<{ workspaceId: string; sourceId: string }> };
export async function GET(r: Request, c: Context) {
  return run(r, false, async (ctx) =>
    executeOperation(ctx, "context_get", {
      ...(await c.params),
      limit: LIMITS.sourceChars,
    }),
  );
}
export async function DELETE(r: Request, c: Context) {
  return run(r, true, async (ctx) =>
    executeOperation(ctx, "context_delete", await c.params),
  );
}
