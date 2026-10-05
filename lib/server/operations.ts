import type { AiConfig } from "../ai/config";
import {
  isOperation,
  operations,
  type Operation,
  type OperationInput,
} from "../domain/operations";
import { DomainError } from "../domain/models";
import { generateProposal } from "./generation";
import { Repository } from "./repository";
import type { StudioService } from "./service";

export type OperationContext = {
  service: StudioService;
  /** Resolved lazily: only AI operations need provider configuration. */
  ai: () => AiConfig;
};
type Handlers = {
  [N in Operation]: (
    ctx: OperationContext,
    args: OperationInput<N>,
  ) => Promise<unknown>;
};

const handlers: Handlers = {
  workspace_list: ({ service }) => service.workspaces(),
  workspace_create: ({ service }, a) => service.createWorkspace(a.id, a.name),
  workspace_delete: ({ service }, a) => service.deleteWorkspace(a.workspaceId),
  workspace_settings_get: ({ service }, a) => service.settings(a.workspaceId),
  workspace_settings_update: ({ service }, a) =>
    service.updateSettings(a.workspaceId, a.baseRevision, a.patch),
  production_list: ({ service }, a) =>
    service.page(a.workspaceId, a.limit, a.cursor, a.query),
  production_get: ({ service }, a) =>
    service.detail(a.workspaceId, a.productionId, a.includeBodies),
  item_get: ({ service }, a) =>
    service.item(a.workspaceId, a.productionId, a.itemId, a.offset, a.limit),
  production_history: ({ service }, a) =>
    service.historyPage(a.workspaceId, a.productionId, a.limit, a.before),
  production_snapshot: ({ service }, a) =>
    service.snapshot(a.workspaceId, a.productionId, a.revision),
  production_review: ({ service }, a) =>
    service.review(a.workspaceId, a.productionId),
  production_save: ({ service }, a) =>
    service.save(
      a.workspaceId,
      a.productionId,
      a.data,
      a.baseRevision,
      a.idempotencyKey,
    ),
  production_restore: ({ service }, a) =>
    service.restore(
      a.workspaceId,
      a.productionId,
      a.revision,
      a.baseRevision,
      a.idempotencyKey,
    ),
  production_delete: ({ service }, a) =>
    service.deleteProduction(a.workspaceId, a.productionId),
  item_patch: ({ service }, a) =>
    service.patchItem(
      a.workspaceId,
      a.productionId,
      a.itemId,
      a.baseHash,
      a.replacement,
      a.idempotencyKey,
    ),
  brief_patch: ({ service }, a) =>
    service.patchBrief(
      a.workspaceId,
      a.productionId,
      a.baseRevision,
      a.fields,
      a.idempotencyKey,
    ),
  context_list: ({ service }, a) =>
    service.sources(a.workspaceId, a.limit, a.cursor),
  context_get: ({ service }, a) =>
    service.source(a.workspaceId, a.sourceId, a.offset, a.limit),
  context_search: ({ service }, a) =>
    service.searchSources(a.workspaceId, a.query, a.limit),
  context_import: ({ service }, a) =>
    service.addSource(a.workspaceId, a.source),
  context_update: ({ service }, a) =>
    service.updateSource(a.workspaceId, a.sourceId, a.aiExcluded),
  context_delete: ({ service }, a) =>
    service.deleteSource(a.workspaceId, a.sourceId),
  change_list: ({ service }, a) =>
    service.changes(
      a.workspaceId,
      {
        productionId: a.productionId,
        status: a.status,
        limit: a.limit,
        cursor: a.cursor,
      },
      a.includeText,
    ),
  change_get: ({ service }, a) => service.change(a.workspaceId, a.changeId),
  change_propose: ({ service }, a) => service.propose(a.workspaceId, a),
  change_apply: ({ service }, a) => service.apply(a.workspaceId, a.changeId),
  change_reject: ({ service }, a) => service.reject(a.workspaceId, a.changeId),
  production_revise: async ({ service, ai }, a) => {
    const config = ai();
    if (!Object.keys(config.providers).length)
      throw new DomainError(
        "AI_NOT_CONFIGURED",
        503,
        "AI generation requires server-side provider configuration.",
      );
    const { workspaceId, includeText, ...input } = a;
    const change = await generateProposal(service, config, workspaceId, input);
    return includeText ? change : Repository.summarize(change);
  },
  usage_get: ({ service, ai }, a) =>
    service.usage(a.workspaceId, ai().monthlyTokenBudget),
};

const targetOf = (args: unknown) => {
  const a = (args ?? {}) as Record<string, unknown>;
  for (const key of ["productionId", "sourceId", "changeId", "id"])
    if (typeof a[key] === "string") return a[key] as string;
  return null;
};

/**
 * The single entry point for every transport. Checks the caller's scope,
 * validates input strictly, runs the handler and writes an audit event for
 * every mutation and every denial (identifiers only, never content).
 */
export async function executeOperation(
  ctx: OperationContext,
  name: string,
  input: unknown,
): Promise<unknown> {
  if (!isOperation(name))
    throw new DomainError("UNKNOWN_OPERATION", 400, "Unknown operation.");
  const definition = operations[name];
  const { actor, repository } = ctx.service;
  const workspaceId =
    typeof (input as { workspaceId?: unknown })?.workspaceId === "string"
      ? (input as { workspaceId: string }).workspaceId
      : null;
  const audit = (
    outcome: "succeeded" | "denied" | "failed",
    errorCode: string | null,
  ) =>
    repository
      .recordAudit({
        workspaceId,
        actorId: actor.userId,
        channel: actor.channel,
        clientId: actor.clientId,
        operation: name,
        targetId: targetOf(input),
        outcome,
        errorCode,
        requestId: actor.requestId,
      })
      .catch((e) =>
        console.error(
          JSON.stringify({
            event: "audit_failed",
            requestId: actor.requestId,
            error: String(e),
          }),
        ),
      );
  if (!actor.scopes.includes(definition.scope)) {
    await audit("denied", "FORBIDDEN_SCOPE");
    throw new DomainError(
      "FORBIDDEN_SCOPE",
      403,
      `This connection is not allowed to ${name.replace("_", " ")}.`,
    );
  }
  const args = definition.input.parse(input);
  const readOnly = "readOnly" in definition && definition.readOnly;
  try {
    const result = await (
      handlers[name] as (c: OperationContext, a: unknown) => Promise<unknown>
    )(ctx, args);
    if (!readOnly) await audit("succeeded", null);
    return result;
  } catch (e) {
    const denied = e instanceof DomainError && e.status === 403;
    if (!readOnly || denied)
      await audit(
        denied ? "denied" : "failed",
        e instanceof DomainError ? e.code : "INTERNAL",
      );
    throw e;
  }
}
