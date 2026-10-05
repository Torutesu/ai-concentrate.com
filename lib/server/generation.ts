import { buildContext } from "../ai/context";
import type { AiConfig } from "../ai/config";
import { runTask } from "../ai/router";
import {
  ITEM_REVISE,
  REVISE_SCHEMA,
  buildRevisePrompt,
  parseReviseOutput,
  reviseOutputTokens,
  reviseTier,
} from "../ai/tasks/item-revise";
import { invalidOutput } from "../ai/types";
import { unsupportedFacts } from "../ai/warnings";
import { digest } from "../domain/hash";
import {
  DomainError,
  assertAggregateBudget,
  type Change,
} from "../domain/models";
import type { StudioService } from "./service";

export type ReviseInput = {
  productionId: string;
  itemId: string;
  baseRevision: number;
  instruction: string;
  idempotencyKey: string;
};

/**
 * Server-side AI revision. The result is an unapplied proposal: nothing in the
 * production changes until a person (or a permitted agent) applies it.
 * Order: authorize → budget → idempotent admission → context → provider →
 * validate → store proposal with provenance. Every provider attempt is
 * recorded in ai_runs whether or not it succeeds.
 */
export async function generateProposal(
  service: StudioService,
  ai: AiConfig,
  workspaceId: string,
  input: ReviseInput,
): Promise<Change> {
  const { repository, actor } = service;
  const target = await service.proposedTarget(
    workspaceId,
    input.productionId,
    input.itemId,
    input.baseRevision,
  );
  const fingerprint = await digest(JSON.stringify(input));
  // A replayed key returns the stored proposal without spending budget again.
  const replay = await repository.claimGeneration(
    workspaceId,
    input.idempotencyKey,
    fingerprint,
  );
  if (replay) return replay;
  try {
    await service.assertBudget(ai.monthlyTokenBudget);
    const { settings } = await repository.settings(workspaceId);
    const { production, item } = target;
    const context = await buildContext(
      repository,
      workspaceId,
      settings,
      production.data,
      item.title,
      ai.contextTokens,
    );
    const parts = buildRevisePrompt({
      production: production.data,
      item,
      instruction: input.instruction,
      context: context.text,
    });
    let runId: string | null = null;
    const { result, ref } = await runTask(
      ai,
      {
        tier: reviseTier(item),
        parts,
        schema: REVISE_SCHEMA,
        schemaName: "revision",
        maxOutputTokens: reviseOutputTokens(item.body),
        cacheKey: `ws:${workspaceId}:${context.hash.slice(0, 16)}`,
        policy: settings.policy,
      },
      async (attempt) => {
        const id = crypto.randomUUID();
        if (attempt.result) runId = id;
        const usage = attempt.result?.usage ?? attempt.error?.usage;
        await repository.recordRun({
          id,
          workspaceId,
          actorId: actor.userId,
          channel: actor.channel,
          clientId: actor.clientId,
          task: ITEM_REVISE.id,
          taskVersion: ITEM_REVISE.version,
          provider: attempt.ref.provider,
          model: attempt.ref.model,
          attempt: attempt.attempt,
          status: attempt.result ? "succeeded" : "failed",
          inputTokens: usage?.inputTokens ?? null,
          cachedInputTokens: usage?.cachedInputTokens ?? null,
          outputTokens: usage?.outputTokens ?? null,
          reasoningTokens: usage?.reasoningTokens ?? null,
          costMicros: attempt.costMicros,
          latencyMs: attempt.latencyMs,
          errorCode: attempt.error?.code ?? null,
          redactions: context.redactions,
          contextHash: context.hash,
        });
      },
    );
    let after: string;
    try {
      after = parseReviseOutput(result.output, item.body);
    } catch (e) {
      if (e instanceof DomainError && e.code.startsWith("EDIT_"))
        throw new DomainError(
          "INVALID_OUTPUT",
          502,
          `The AI's edit could not be applied: ${e.message}`,
        );
      throw invalidOutput();
    }
    assertAggregateBudget({
      ...production.data,
      items: production.data.items.map((i) =>
        i.id === item.id ? { ...i, body: after } : i,
      ),
    });
    const change: Change = {
      id: crypto.randomUUID(),
      workspaceId,
      productionId: input.productionId,
      itemId: input.itemId,
      baseRevision: input.baseRevision,
      beforeHash: await digest(item.body),
      before: item.body,
      after,
      instruction: input.instruction,
      sourceIds: context.sourceIds,
      createdAt: new Date().toISOString(),
      createdBy: actor.userId,
      status: "proposed",
      origin: {
        kind: "server_ai",
        task: ITEM_REVISE.id,
        taskVersion: ITEM_REVISE.version,
        provider: ref.provider,
        model: ref.model,
        runId: runId ?? "",
        sourceChunkIds: context.chunkIds,
        contextHash: context.hash,
      },
      warnings: unsupportedFacts(after, [item.body, parts.task, context.text]),
    };
    return await repository.finishGeneration(
      change,
      input.idempotencyKey,
      runId,
    );
  } catch (e) {
    // A budget refusal never reached a provider: release the claim so it does
    // not count against admission. Everything else is recorded as failed.
    if (e instanceof DomainError && e.code === "AI_BUDGET")
      await repository.releaseGeneration(workspaceId, input.idempotencyKey);
    else await repository.failGeneration(workspaceId, input.idempotencyKey);
    throw e;
  }
}
