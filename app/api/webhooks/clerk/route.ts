import { clerkWebhookSecret, database } from "@/lib/platform/runtime";
import { Repository } from "../../../../lib/server/repository";
import { errorResponse, requestIdOf } from "../../../../lib/server/http";
import { verifySvix } from "../../../../lib/server/webhooks";
import { DomainError } from "../../../../lib/domain/models";

/**
 * Clerk `user.deleted`: removes the person's memberships, starts deletion of
 * workspaces they solely own and pseudonymizes their ID in history and ledgers.
 */
export async function POST(r: Request) {
  const requestId = requestIdOf(r);
  try {
    const secret = clerkWebhookSecret();
    if (!secret) return new Response(null, { status: 404 });
    const payload = await r.text();
    if (
      payload.length > 100_000 ||
      !(await verifySvix(secret, r.headers, payload))
    )
      throw new DomainError("UNAUTHENTICATED", 401, "Invalid signature.");
    const event = JSON.parse(payload) as {
      type?: string;
      data?: { id?: unknown };
    };
    if (event.type === "user.deleted" && typeof event.data?.id === "string")
      await new Repository(database()).removeUser(event.data.id);
    return Response.json({ received: true });
  } catch (e) {
    return errorResponse(e, requestId);
  }
}
