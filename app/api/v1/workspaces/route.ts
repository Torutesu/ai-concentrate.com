import { z } from "zod";
import { body, run } from "../../../../lib/server/http";
import { executeOperation } from "../../../../lib/server/operations";
import { idSchema } from "../../../../lib/domain/models";
export async function GET(r: Request) {
  return run(r, false, async (ctx) => ({
    workspaces: await executeOperation(ctx, "workspace_list", {}),
  }));
}
/** Send a client-generated `id` to make retries idempotent. */
export async function POST(r: Request) {
  return run(r, true, async (ctx) => {
    const p = await body(
      r,
      z.object({ name: z.string(), id: idSchema.optional() }).strict(),
    );
    return {
      workspace: await executeOperation(ctx, "workspace_create", {
        id: p.id ?? crypto.randomUUID(),
        name: p.name,
      }),
    };
  });
}
