import { database, getUser } from "@/lib/platform/runtime";
import { Repository } from "./repository";
import { StudioService } from "./service";
import { DomainError } from "../domain/models";
import { ZodError, type ZodType } from "zod";
export async function service(request: Request, write = false) {
  if (write) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new DomainError(
        "ORIGIN",
        403,
        "Cross-origin writes are not allowed.",
      );
  }
  const user = await getUser();
  if (!user)
    throw new DomainError("UNAUTHENTICATED", 401, "Sign in to continue.");
  return new StudioService(new Repository(database()), user.userId);
}
export async function body<T>(r: Request, schema: ZodType<T>): Promise<T> {
  if (!r.headers.get("content-type")?.includes("application/json"))
    throw new DomainError("CONTENT_TYPE", 415, "Use application/json.");
  const reader = r.body?.getReader();
  if (!reader) throw new DomainError("INVALID_JSON", 400, "Empty request.");
  const chunks: Uint8Array[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > 300000) {
      await reader.cancel();
      throw new DomainError("TOO_LARGE", 413, "Request too large.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const c of chunks) {
    bytes.set(c, offset);
    offset += c.byteLength;
  }
  const text = new TextDecoder().decode(bytes);
  try {
    return schema.parse(JSON.parse(text));
  } catch (e) {
    if (e instanceof ZodError) throw e;
    throw new DomainError("INVALID_JSON", 400, "Invalid JSON.");
  }
}
export async function handle(fn: () => Promise<unknown>) {
  try {
    return Response.json(await fn(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    const known = e instanceof DomainError;
    return Response.json(
      {
        error: {
          code: known
            ? e.code
            : e instanceof ZodError
              ? "VALIDATION"
              : "INTERNAL",
          message: known
            ? e.message
            : e instanceof ZodError
              ? "Check the submitted fields."
              : "The operation could not be completed.",
        },
      },
      {
        status: known ? e.status : e instanceof ZodError ? 400 : 500,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
