import {
  aiEnv,
  database,
  getIdentity,
  protectedResourceMetadata,
} from "@/lib/platform/runtime";
import { ZodError, type ZodType } from "zod";
import { loadAiConfig, type AiConfig, type AiEnv } from "../ai/config";
import { agentScopes, HUMAN_SCOPES, type Actor } from "../domain/actor";
import { LIMITS } from "../domain/limits";
import { DomainError } from "../domain/models";
import type { OperationContext } from "./operations";
import { Repository } from "./repository";
import { StudioService } from "./service";

let cached: { env: AiEnv; config: AiConfig } | undefined;
/** Providers are built once per process/isolate, not per request. */
export function aiConfig() {
  const env = aiEnv();
  if (cached?.env !== env) cached = { env, config: loadAiConfig(env) };
  return cached.config;
}

export const requestIdOf = (r: Request) =>
  r.headers.get("x-request-id")?.match(/^[\w-]{8,64}$/)?.[0] ??
  crypto.randomUUID();

/** Resolves the verified caller. Throws 401 without a valid session or token. */
export async function operationContext(
  request: Request,
  requestId: string,
  write: boolean,
): Promise<OperationContext> {
  if (write) {
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new DomainError(
        "ORIGIN",
        403,
        "Cross-origin writes are not allowed.",
      );
  }
  const identity = await getIdentity(request);
  if (!identity)
    throw new DomainError("UNAUTHENTICATED", 401, "Sign in to continue.");
  const actor: Actor = {
    userId: identity.userId,
    channel: identity.agent ? "mcp" : "web",
    clientId: identity.clientId,
    scopes: identity.agent ? agentScopes(identity.tokenScopes) : HUMAN_SCOPES,
    requestId,
  };
  return {
    service: new StudioService(new Repository(database()), actor),
    ai: aiConfig,
  };
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
    if (length > LIMITS.requestBytes) {
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
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    throw new DomainError("INVALID_JSON", 400, "Invalid JSON.");
  }
  return schema.parse(parsed);
}

/** Safe error body: domain errors and field issues; internal details are only logged. */
export function errorResponse(
  e: unknown,
  requestId: string,
  request?: Request,
) {
  const headers: Record<string, string> = {
    "Cache-Control": "no-store",
    "X-Request-Id": requestId,
  };
  if (e instanceof DomainError) {
    if (e.status === 401 && request) {
      const origin = new URL(request.url).origin;
      // Lets MCP clients discover where to obtain an access token (RFC 9728).
      if (protectedResourceMetadata(origin))
        headers["WWW-Authenticate"] =
          `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`;
    }
    return Response.json(
      { error: { code: e.code, message: e.message } },
      { status: e.status, headers },
    );
  }
  if (e instanceof ZodError)
    return Response.json(
      {
        error: {
          code: "VALIDATION",
          message: "Check the submitted fields.",
          issues: e.issues
            .slice(0, 10)
            .map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 400, headers },
    );
  console.error(
    JSON.stringify({
      event: "unhandled_error",
      requestId,
      path: request ? new URL(request.url).pathname : undefined,
      name: e instanceof Error ? e.name : typeof e,
      message: e instanceof Error ? e.message.slice(0, 300) : undefined,
    }),
  );
  return Response.json(
    {
      error: {
        code: "INTERNAL",
        message: "The operation could not be completed.",
      },
    },
    { status: 500, headers },
  );
}

/** Wraps a REST adapter: verified context, JSON response, safe errors. */
export async function run(
  request: Request,
  write: boolean,
  fn: (ctx: OperationContext) => Promise<unknown>,
) {
  const requestId = requestIdOf(request);
  try {
    const ctx = await operationContext(request, requestId, write);
    return Response.json(await fn(ctx), {
      headers: { "Cache-Control": "no-store", "X-Request-Id": requestId },
    });
  } catch (e) {
    return errorResponse(e, requestId, request);
  }
}
