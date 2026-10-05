import { body, run } from "../../../../../../../lib/server/http";
import { executeOperation } from "../../../../../../../lib/server/operations";
import { saveSchema } from "../../../../../../../lib/domain/models";
type Context = {
  params: Promise<{ workspaceId: string; productionId: string }>;
};
export async function GET(r: Request, c: Context) {
  return run(r, false, async (ctx) =>
    executeOperation(ctx, "production_get", {
      ...(await c.params),
      includeBodies: true,
    }),
  );
}
export async function PUT(r: Request, c: Context) {
  return run(r, true, async (ctx) => {
    const input = await body(r, saveSchema);
    return {
      production: await executeOperation(ctx, "production_save", {
        ...(await c.params),
        ...input,
      }),
    };
  });
}
export async function DELETE(r: Request, c: Context) {
  return run(r, true, async (ctx) =>
    executeOperation(ctx, "production_delete", await c.params),
  );
}
