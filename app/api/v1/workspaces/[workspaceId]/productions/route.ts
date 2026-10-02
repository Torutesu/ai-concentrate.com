import { handle, service } from "../../../../../../lib/server/http";
import { idSchema } from "../../../../../../lib/domain/models";
export async function GET(
  r: Request,
  c: { params: Promise<{ workspaceId: string }> },
) {
  return handle(async () => {
    const { workspaceId } = await c.params;
    return {
      productions: await (await service(r)).read(idSchema.parse(workspaceId)),
    };
  });
}
