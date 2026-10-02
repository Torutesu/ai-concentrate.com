import { z } from "zod";
import { body, handle, service } from "../../../../lib/server/http";
import { executeOperation } from "../../../../lib/server/operations";
import {
  operationSchemas,
  type Operation,
} from "../../../../lib/domain/operations";
import { DomainError } from "../../../../lib/domain/models";
import { aiProvider } from "../../../../lib/server/ai";
export async function POST(r: Request) {
  return handle(async () => {
    const s = await service(r, true),
      p = await body(
        r,
        z.object({ name: z.string(), arguments: z.unknown() }).strict(),
      );
    if (!Object.hasOwn(operationSchemas, p.name))
      throw new DomainError("UNKNOWN_OPERATION", 400, "Unknown operation.");
    return {
      data: await executeOperation(
        s,
        p.name as Operation,
        p.arguments,
        p.name === "production_revise" ? aiProvider() : undefined,
      ),
    };
  });
}
