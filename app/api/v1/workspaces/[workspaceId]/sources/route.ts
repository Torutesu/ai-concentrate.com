import { body, handle, service } from "../../../../../../lib/server/http";
import { idSchema, sourceSchema } from "../../../../../../lib/domain/models";
type Context = { params: Promise<{ workspaceId: string }> };
export async function GET(r: Request, c: Context) {
  return handle(async () => {
    const s = await service(r);
    return {
      sources: await s.sources(idSchema.parse((await c.params).workspaceId)),
    };
  });
}
export async function POST(r: Request, c: Context) {
  return handle(async () => {
    const s = await service(r, true);
    return {
      source: await s.addSource(
        idSchema.parse((await c.params).workspaceId),
        await body(r, sourceSchema),
      ),
    };
  });
}
