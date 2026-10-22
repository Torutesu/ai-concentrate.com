import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";
import type { Database } from "../lib/platform/database";
import { Repository } from "../lib/server/repository";
import {
  BASE_SECURITY_HEADERS,
  withHeaders,
} from "../lib/server/security-headers";

export default {
  fetch(
    request: Request,
    env: Cloudflare.Env,
    ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>,
  ) {
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt)
            return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return {
              status: "request_context_expired",
              message: "This request has expired. Please try again.",
            };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, async () =>
      withHeaders(
        await handler.fetch(request, env, ctx),
        BASE_SECURITY_HEADERS,
      ),
    );
  },
  /** Daily retention (cron trigger in vite.config.ts), same job as Vercel Cron. */
  scheduled(
    _controller: ScheduledController,
    env: Cloudflare.Env,
    ctx: ExecutionContext,
  ) {
    const db = (env as unknown as { DB?: Database }).DB;
    if (!db) return;
    ctx.waitUntil(
      new Repository(db)
        .purge()
        .then((purged) =>
          console.log(JSON.stringify({ event: "retention_purge", purged })),
        ),
    );
  },
};
