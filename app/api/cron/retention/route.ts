import { cronSecret, database } from "@/lib/platform/runtime";
import { Repository } from "../../../../lib/server/repository";
import { errorResponse, requestIdOf } from "../../../../lib/server/http";
import { DomainError } from "../../../../lib/domain/models";

/**
 * Daily retention purge (see RETENTION in lib/domain/limits.ts). Vercel Cron
 * sends `Authorization: Bearer $CRON_SECRET`; without the secret the route is closed.
 */
export async function GET(r: Request) {
  const requestId = requestIdOf(r);
  try {
    const secret = cronSecret();
    if (!secret || r.headers.get("authorization") !== `Bearer ${secret}`)
      throw new DomainError("UNAUTHENTICATED", 401, "Not allowed.");
    const purged = await new Repository(database()).purge();
    console.log(
      JSON.stringify({ event: "retention_purge", requestId, purged }),
    );
    return Response.json(
      { purged },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return errorResponse(e, requestId);
  }
}
