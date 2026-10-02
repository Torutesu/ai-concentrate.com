import { z } from "zod";
import { body, handle, service } from "../../../../lib/server/http";
export async function GET(r: Request) {
  return handle(async () => {
    const s = await service(r);
    return { workspaces: await s.repository.list(s.actorId) };
  });
}
export async function POST(r: Request) {
  return handle(async () => {
    const s = await service(r, true),
      p = await body(
        r,
        z.object({ name: z.string().trim().min(1).max(120) }).strict(),
      );
    return { workspace: await s.repository.create(s.actorId, p.name) };
  });
}
