import { handle, service } from "../../../../../../lib/server/http";
import { idSchema } from "../../../../../../lib/domain/models";
export async function GET(
  r: Request,
  c: { params: Promise<{ workspaceId: string }> },
) {
  return handle(async () => {
    const { workspaceId } = await c.params;
    return {
      ...(await (
        await service(r)
      ).page(
        idSchema.parse(workspaceId),
        20,
        new URL(r.url).searchParams.get("cursor") ?? undefined,
      )),
    };
  });
}
