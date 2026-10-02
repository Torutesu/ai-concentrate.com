import { body, handle, service } from "../../../../../../lib/server/http";
import { idSchema, proposalSchema } from "../../../../../../lib/domain/models";
import { aiProvider } from "../../../../../../lib/server/ai";
import { generateProposal } from "../../../../../../lib/server/service";
export async function POST(
  r: Request,
  c: { params: Promise<{ workspaceId: string }> },
) {
  return handle(async () => {
    const w = idSchema.parse((await c.params).workspaceId),
      s = await service(r, true),
      p = await body(r, proposalSchema);
    return { change: await generateProposal(s, aiProvider(), w, p) };
  });
}
