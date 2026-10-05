import { body, run } from "../../../../../../lib/server/http";
import { executeOperation } from "../../../../../../lib/server/operations";
import { sourceSchema } from "../../../../../../lib/domain/models";
type Context = { params: Promise<{ workspaceId: string }> };
/** Summaries only; full text is fetched per source when opened. */
export async function GET(r: Request, c: Context) {
  return run(r, false, async (ctx) => {
    const page = (await executeOperation(ctx, "context_list", {
      ...(await c.params),
      limit: 50,
    })) as { items: unknown[] };
    return { sources: page.items };
  });
}
export async function POST(r: Request, c: Context) {
  return run(r, true, async (ctx) => {
    const source = await body(r, sourceSchema);
    return {
      source: await executeOperation(ctx, "context_import", {
        ...(await c.params),
        source,
      }),
    };
  });
}
