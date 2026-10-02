import { body, handle, service } from "../../../../../../../lib/server/http";
import { idSchema, saveSchema } from "../../../../../../../lib/domain/models";
type Context = {
  params: Promise<{ workspaceId: string; productionId: string }>;
};
export async function GET(r: Request, c: Context) {
  return handle(async () => {
    const p = await c.params,
      s = await service(r);
    idSchema.parse(p.workspaceId);
    idSchema.parse(p.productionId);
    return s.detail(p.workspaceId, p.productionId);
  });
}
export async function PUT(r: Request, c: Context) {
  return handle(async () => {
    const p = await c.params,
      s = await service(r, true),
      input = await body(r, saveSchema);
    return {
      production: await s.save(
        idSchema.parse(p.workspaceId),
        idSchema.parse(p.productionId),
        input.data,
        input.baseRevision,
        input.idempotencyKey,
      ),
    };
  });
}
