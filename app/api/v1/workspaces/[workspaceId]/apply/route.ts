import { z } from "zod";
import { body, handle, service } from "../../../../../../lib/server/http";
import { idSchema } from "../../../../../../lib/domain/models";
export async function POST(
  r: Request,
  c: { params: Promise<{ workspaceId: string }> },
) {
  return handle(async () => {
    const w = idSchema.parse((await c.params).workspaceId),
      s = await service(r, true),
      p = await body(r, z.object({ changeId: idSchema }).strict());
    return { production: await s.apply(w, p.changeId) };
  });
}
