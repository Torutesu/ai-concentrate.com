import { cronSecret, database } from "@/lib/platform/runtime";
import { checkHealth } from "../../../lib/server/health";
import { bearerMatches } from "../../../lib/server/webhooks";

/**
 * Uptime/readiness probe. Public callers get only the status; the missing
 * schema columns are listed only with `Authorization: Bearer $CRON_SECRET`.
 */
export async function GET(r: Request) {
  let health;
  try {
    health = await checkHealth(database());
  } catch {
    health = { status: "unavailable" as const, reason: "database" as const };
  }
  const detailed = bearerMatches(r.headers.get("authorization"), cronSecret());
  const body =
    health.status === "ok"
      ? health
      : detailed
        ? health
        : { status: health.status, reason: health.reason };
  return Response.json(body, {
    status: health.status === "ok" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
