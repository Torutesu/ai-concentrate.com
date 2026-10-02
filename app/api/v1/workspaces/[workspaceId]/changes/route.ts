import { handle, service } from "../../../../../../lib/server/http";
import { idSchema } from "../../../../../../lib/domain/models";
export async function GET(
  r: Request,
  c: { params: Promise<{ workspaceId: string }> },
) {
  return handle(async () => {
    const w = idSchema.parse((await c.params).workspaceId),
      s = await service(r);
    return { changes: await s.changes(w) };
  });
}
