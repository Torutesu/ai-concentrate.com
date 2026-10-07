import { reviewReadiness } from "../agents/marketing";
import type { Actor, Scope } from "../domain/actor";
import { digest } from "../domain/hash";
import { LIMITS, RETENTION } from "../domain/limits";
import {
  DomainError,
  applyChange,
  assertAggregateBudget,
  idSchema,
  itemSchema,
  productionSchema,
  requireEdit,
  requireOwner,
  sourceSchema,
  validateSave,
  type Change,
  type ChangeStatus,
  type ItemSummary,
  type Production,
  type Source,
  type VersionedProduction,
} from "../domain/models";
import { settingsSchema, type WorkspaceSettings } from "../domain/settings";
import { applyEdits, chunkText, type Edit } from "../domain/text";
import { detectSensitive } from "../ai/redact";
import { unsupportedFacts } from "../ai/warnings";
import { ftsPhrase, Repository } from "./repository";

export type Replacement = { body?: string; edits?: Edit[] };
const monthStart = (at = new Date()) =>
  new Date(Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), 1)).toISOString();

/**
 * Application service: every read and write checks workspace membership, the
 * caller's scope and revision/idempotency rules. Transports (Web REST, HTTP
 * operations, MCP, CLI) call this through lib/server/operations.ts only.
 */
export class StudioService {
  constructor(
    public repository: Repository,
    public actor: Actor,
  ) {}
  get actorId() {
    return this.actor.userId;
  }
  hasScope(scope: Scope) {
    return this.actor.scopes.includes(scope);
  }

  // ---------------------------------------------------------------- workspaces
  async workspaces() {
    return this.repository.list(this.actorId);
  }
  async createWorkspace(id: string, name: string) {
    idSchema.parse(id);
    const trimmed = name.trim();
    if (!trimmed || trimmed.length > 120)
      throw new DomainError("VALIDATION", 400, "Invalid workspace name.");
    return this.repository.create(this.actorId, trimmed, id);
  }
  async deleteWorkspace(workspaceId: string) {
    requireOwner(await this.repository.role(workspaceId, this.actorId));
    await this.repository.softDeleteWorkspace(workspaceId);
    return { deleted: true, purgeAfterDays: RETENTION.workspaceGraceDays };
  }
  async settings(workspaceId: string) {
    const role = await this.repository.role(workspaceId, this.actorId);
    return { ...(await this.repository.settings(workspaceId)), role };
  }
  async updateSettings(
    workspaceId: string,
    baseRevision: number,
    patch: {
      policy?: Partial<WorkspaceSettings["policy"]>;
      profile?: Partial<WorkspaceSettings["profile"]>;
    },
  ) {
    const role = await this.repository.role(workspaceId, this.actorId);
    if (patch.policy) requireOwner(role);
    else requireEdit(role);
    const current = await this.repository.settings(workspaceId);
    const next = settingsSchema.parse({
      policy: { ...current.settings.policy, ...patch.policy },
      profile: { ...current.settings.profile, ...patch.profile },
    });
    return this.repository.updateSettings(workspaceId, next, baseRevision);
  }

  // --------------------------------------------------------------- productions
  async page(
    workspaceId: string,
    limit: number = LIMITS.pageSize,
    cursor?: string,
    query = "",
  ) {
    await this.repository.role(workspaceId, this.actorId);
    return this.repository.pageProductions(workspaceId, limit, cursor, query);
  }
  async detail(workspaceId: string, id: string, includeBodies = true) {
    await this.repository.role(workspaceId, this.actorId);
    const production = await this.requireProduction(workspaceId, id);
    const history = (await this.repository.historyPage(workspaceId, id, 30))
      .items;
    if (includeBodies) return { production, history };
    const items: ItemSummary[] = await Promise.all(
      production.data.items.map(async ({ body, ...meta }) => ({
        ...meta,
        chars: body.length,
        hash: await digest(body),
      })),
    );
    return {
      production: { ...production, data: { ...production.data, items } },
      history,
    };
  }
  async item(
    workspaceId: string,
    productionId: string,
    itemId: string,
    offset: number,
    limit: number,
  ) {
    await this.repository.role(workspaceId, this.actorId);
    const production = await this.requireProduction(workspaceId, productionId);
    const item = production.data.items.find((i) => i.id === itemId);
    if (!item) throw new DomainError("NOT_FOUND", 404, "Item not found.");
    const end = Math.min(item.body.length, offset + limit);
    const { body, ...meta } = item;
    return {
      productionId,
      revision: production.revision,
      item: { ...meta, chars: body.length, hash: await digest(body) },
      text: body.slice(offset, end),
      offset,
      nextOffset: end < body.length ? end : null,
    };
  }
  async historyPage(
    workspaceId: string,
    id: string,
    limit: number,
    before?: number,
  ) {
    await this.repository.role(workspaceId, this.actorId);
    await this.requireProduction(workspaceId, id);
    return this.repository.historyPage(workspaceId, id, limit, before);
  }
  async snapshot(workspaceId: string, id: string, revision: number) {
    await this.repository.role(workspaceId, this.actorId);
    return {
      workspaceId,
      productionId: id,
      revision,
      data: await this.repository.revision(workspaceId, id, revision),
    };
  }
  async review(workspaceId: string, id: string) {
    await this.repository.role(workspaceId, this.actorId);
    const production = await this.requireProduction(workspaceId, id);
    return reviewReadiness(
      production.data,
      await this.repository.sourceCount(workspaceId),
    );
  }
  async restore(
    workspaceId: string,
    id: string,
    revision: number,
    baseRevision: number,
    key: string,
  ) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    const data = await this.repository.revision(workspaceId, id, revision);
    return this.save(workspaceId, id, data, baseRevision, key);
  }
  async save(
    workspaceId: string,
    id: string,
    data: Production,
    baseRevision: number,
    key: string,
  ) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    data = productionSchema.parse(data);
    const fingerprint = await digest(
      JSON.stringify({ id, data, baseRevision }),
    );
    const replay = await this.repository.receipt(workspaceId, key, fingerprint);
    if (replay) return replay;
    validateSave(
      await this.repository.get(workspaceId, id),
      data,
      baseRevision,
    );
    return this.commit(workspaceId, id, data, baseRevision, key, fingerprint);
  }
  /** Edits one item against its text hash, so unrelated concurrent edits do not conflict. */
  async patchItem(
    workspaceId: string,
    productionId: string,
    itemId: string,
    baseHash: string,
    replacement: Replacement,
    key: string,
  ) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    const fingerprint = await digest(
      JSON.stringify({
        op: "item_patch",
        productionId,
        itemId,
        baseHash,
        replacement,
      }),
    );
    const replay = await this.repository.receipt(workspaceId, key, fingerprint);
    if (replay) return compact(replay, itemId);
    const current = await this.requireProduction(workspaceId, productionId);
    const item = await this.unlockedTarget(current, itemId, baseHash);
    const body = resolveReplacement(item.body, replacement);
    const data: Production = {
      ...current.data,
      items: current.data.items.map((i) =>
        i.id === itemId ? { ...i, body } : i,
      ),
    };
    productionSchema.parse(data);
    return compact(
      await this.commit(
        workspaceId,
        productionId,
        data,
        current.revision,
        key,
        fingerprint,
      ),
      itemId,
    );
  }
  async patchBrief(
    workspaceId: string,
    productionId: string,
    baseRevision: number,
    fields: Partial<Production>,
    key: string,
  ) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    const fingerprint = await digest(
      JSON.stringify({ op: "brief_patch", productionId, baseRevision, fields }),
    );
    const replay = await this.repository.receipt(workspaceId, key, fingerprint);
    if (replay) return compact(replay);
    const current = await this.requireProduction(workspaceId, productionId);
    if (current.revision !== baseRevision)
      throw new DomainError(
        "CONFLICT",
        409,
        "A newer revision exists. Reload before saving.",
      );
    const data = productionSchema.parse({
      ...current.data,
      ...fields,
      items: current.data.items,
    });
    return compact(
      await this.commit(
        workspaceId,
        productionId,
        data,
        baseRevision,
        key,
        fingerprint,
      ),
    );
  }
  async deleteProduction(workspaceId: string, id: string) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    await this.repository.deleteProduction(workspaceId, id);
    return { deleted: true };
  }

  // ------------------------------------------------------------------- sources
  async sources(
    workspaceId: string,
    limit: number = LIMITS.maxPageSize,
    cursor?: string,
  ) {
    await this.repository.role(workspaceId, this.actorId);
    return this.repository.sourceSummaries(workspaceId, limit, cursor);
  }
  async source(workspaceId: string, id: string, offset: number, limit: number) {
    await this.repository.role(workspaceId, this.actorId);
    const { body, ...meta } = await this.repository.source(workspaceId, id);
    const end = Math.min(body.length, offset + limit);
    return {
      source: { ...meta, chars: body.length },
      text: body.slice(offset, end),
      offset,
      nextOffset: end < body.length ? end : null,
    };
  }
  async searchSources(workspaceId: string, query: string, limit: number) {
    await this.repository.role(workspaceId, this.actorId);
    // Exclusion governs what reaches AI: agents never discover excluded
    // sources through search, while people search their whole library.
    const hits = await this.repository.searchChunks(
      workspaceId,
      ftsPhrase(query),
      limit,
      this.actor.channel === "web",
    );
    return {
      results: hits.map((h) => {
        const at = Math.max(0, h.body.indexOf(query) - 200);
        return {
          sourceId: h.sourceId,
          chunk: h.ordinal,
          excerpt: h.body.slice(at, at + 600),
        };
      }),
    };
  }
  async addSource(
    workspaceId: string,
    input: Pick<Source, "name" | "kind" | "reference" | "body">,
  ) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    const data = sourceSchema.parse(input);
    const source = await this.repository.addSource(
      {
        ...data,
        id: crypto.randomUUID(),
        workspaceId,
        createdAt: new Date().toISOString(),
        hash: await digest(data.body),
      },
      chunkText(data.body),
    );
    const { body, ...meta } = source;
    return {
      ...meta,
      chars: body.length,
      preview: body.slice(0, LIMITS.previewChars),
      truncated: body.length > LIMITS.previewChars,
      aiExcluded: false,
      /** Kinds of secrets/contact data found; they are redacted before AI use. */
      sensitive: detectSensitive(body),
    };
  }
  async updateSource(workspaceId: string, id: string, aiExcluded: boolean) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    await this.repository.setSourceAiExcluded(workspaceId, id, aiExcluded);
    return { id, aiExcluded };
  }
  async deleteSource(workspaceId: string, id: string) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    await this.repository.deleteSource(workspaceId, id);
    return { deleted: true };
  }

  // ------------------------------------------------------------------- changes
  async changes(
    workspaceId: string,
    filter: {
      productionId?: string;
      status?: ChangeStatus;
      limit: number;
      cursor?: string;
    },
    includeText: boolean,
  ) {
    await this.repository.role(workspaceId, this.actorId);
    const result = await this.repository.changes(workspaceId, filter);
    return includeText
      ? result
      : {
          items: result.items.map(Repository.summarize),
          nextCursor: result.nextCursor,
        };
  }
  async change(workspaceId: string, id: string) {
    await this.repository.role(workspaceId, this.actorId);
    return this.repository.change(workspaceId, id);
  }
  async apply(workspaceId: string, id: string) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    const change = await this.repository.change(workspaceId, id);
    await this.authorizeApply(workspaceId, change);
    const key = "apply_" + id;
    const fingerprint = await digest(JSON.stringify({ apply: id }));
    const replay = await this.repository.receipt(workspaceId, key, fingerprint);
    if (replay) return replay;
    const current = await this.requireProduction(
      workspaceId,
      change.productionId,
    );
    const target = current.data.items.find((i) => i.id === change.itemId);
    const data = applyChange(
      current,
      change,
      await digest(target?.body ?? ""),
      change.beforeHash ?? (await digest(change.before)),
    );
    return this.commit(
      workspaceId,
      current.id,
      data,
      current.revision,
      key,
      fingerprint,
      id,
    );
  }
  async reject(workspaceId: string, id: string) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    return Repository.summarize(
      await this.repository.rejectChange(workspaceId, id, this.actorId),
    );
  }
  /** Registers text written by the calling agent's own model; no server AI cost. */
  async propose(
    workspaceId: string,
    input: {
      productionId: string;
      itemId: string;
      baseHash: string;
      instruction: string;
      replacement: Replacement;
      rationale?: string;
      declaredModel?: string;
      idempotencyKey: string;
    },
  ) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    const fingerprint = await digest(JSON.stringify(input));
    const id =
      "cp_" +
      (await digest(`${workspaceId}:${input.idempotencyKey}`)).slice(0, 40);
    const existing = await this.repository
      .change(workspaceId, id)
      .catch((e) =>
        e instanceof DomainError && e.code === "NOT_FOUND"
          ? null
          : Promise.reject(e),
      );
    if (existing) {
      if (
        (existing as Change & { fingerprint?: string }).fingerprint !==
        fingerprint
      )
        throw new DomainError(
          "IDEMPOTENCY_MISMATCH",
          409,
          "This request key was used with different input.",
        );
      return Repository.summarize(existing);
    }
    const current = await this.requireProduction(
      workspaceId,
      input.productionId,
    );
    const item = await this.unlockedTarget(
      current,
      input.itemId,
      input.baseHash,
    );
    const after = resolveReplacement(item.body, input.replacement);
    assertAggregateBudget({
      ...current.data,
      items: current.data.items.map((i) =>
        i.id === item.id ? { ...i, body: after } : i,
      ),
    });
    const change: Change & { fingerprint: string } = {
      id,
      workspaceId,
      productionId: input.productionId,
      itemId: input.itemId,
      baseRevision: current.revision,
      beforeHash: input.baseHash,
      before: item.body,
      after,
      instruction: input.instruction,
      sourceIds: [],
      createdAt: new Date().toISOString(),
      createdBy: this.actorId,
      status: "proposed",
      origin: {
        kind: "client_agent",
        clientId: this.actor.clientId,
        declaredModel: input.declaredModel,
        rationale: input.rationale,
      },
      warnings: unsupportedFacts(after, [
        item.body,
        JSON.stringify(current.data),
        input.instruction,
      ]),
      fingerprint,
    };
    return Repository.summarize(await this.repository.addChange(change));
  }

  // --------------------------------------------------------------------- usage
  async usage(workspaceId: string, monthlyTokenBudget: number) {
    await this.repository.role(workspaceId, this.actorId);
    const since = monthStart();
    const you = await this.repository.usage({ actorId: this.actorId }, since);
    return {
      since,
      workspace: await this.repository.usage({ workspaceId }, since),
      you,
      monthlyTokenBudget,
      remainingTokens: Math.max(0, monthlyTokenBudget - you.billableTokens),
    };
  }
  async assertBudget(monthlyTokenBudget: number) {
    const you = await this.repository.usage(
      { actorId: this.actorId },
      monthStart(),
    );
    if (you.billableTokens >= monthlyTokenBudget)
      throw new DomainError(
        "AI_BUDGET",
        429,
        "Your monthly AI token budget is used up. Edit manually or ask an administrator to raise AI_MONTHLY_TOKEN_BUDGET.",
      );
  }

  // ------------------------------------------------------------------ internal
  /** Validates the size budget, hashes unlocked items for stale detection and writes. */
  private async commit(
    workspaceId: string,
    id: string,
    data: Production,
    base: number,
    key: string,
    fingerprint: string,
    appliedChangeId?: string,
  ) {
    assertAggregateBudget(data);
    const itemHashes = await Promise.all(
      data.items
        .filter((i) => !i.locked)
        .map(async (i) => `${i.id}:${await digest(i.body)}`),
    );
    return this.repository.save({
      workspaceId,
      id,
      data,
      base,
      key,
      fingerprint,
      actorId: this.actorId,
      itemHashes,
      appliedChangeId,
    });
  }
  private async requireProduction(workspaceId: string, id: string) {
    const production = await this.repository.get(workspaceId, id);
    if (!production)
      throw new DomainError("NOT_FOUND", 404, "Production not found.");
    return production;
  }
  private async unlockedTarget(
    current: VersionedProduction,
    itemId: string,
    baseHash: string,
  ) {
    const item = current.data.items.find((i) => i.id === itemId);
    if (!item) throw new DomainError("NOT_FOUND", 404, "Item not found.");
    if (item.locked)
      throw new DomainError("LOCKED", 409, "This item is locked.");
    if ((await digest(item.body)) !== baseHash)
      throw new DomainError(
        "CONFLICT",
        409,
        "The item text changed. Read it again with item_get.",
      );
    return item;
  }
  /** People always may apply; agents only as the workspace policy allows. */
  private async authorizeApply(workspaceId: string, change: Change) {
    if (this.hasScope("studio:apply")) return;
    const { settings } = await this.repository.settings(workspaceId);
    const rule = settings.policy.agentApply;
    const own =
      change.origin?.kind === "client_agent" &&
      change.origin.clientId !== null &&
      change.origin.clientId === this.actor.clientId;
    if (rule === "any" || (rule === "own_proposals" && own)) return;
    throw new DomainError(
      "FORBIDDEN_SCOPE",
      403,
      "Agents cannot apply proposals in this workspace. A person must review and apply it.",
    );
  }
  async proposedTarget(
    workspaceId: string,
    id: string,
    itemId: string,
    revision: number,
  ) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    const p = await this.requireProduction(workspaceId, id);
    if (p.revision !== revision)
      throw new DomainError("CONFLICT", 409, "Reload the current revision.");
    const item = p.data.items.find((i) => i.id === itemId);
    if (!item) throw new DomainError("NOT_FOUND", 404, "Item not found.");
    if (item.locked)
      throw new DomainError("LOCKED", 409, "This item is locked.");
    return { production: p, item };
  }
}

function resolveReplacement(current: string, replacement: Replacement) {
  const body =
    replacement.body !== undefined
      ? replacement.body
      : applyEdits(current, replacement.edits ?? []);
  itemSchema.shape.body.parse(body);
  return body;
}
/** Agents get the new revision and item hash, not the whole aggregate back. */
async function compact(p: VersionedProduction, itemId?: string) {
  const item = itemId ? p.data.items.find((i) => i.id === itemId) : undefined;
  return {
    id: p.id,
    revision: p.revision,
    updatedAt: p.updatedAt,
    ...(item
      ? {
          item: {
            id: item.id,
            chars: item.body.length,
            hash: await digest(item.body),
          },
        }
      : {}),
  };
}
