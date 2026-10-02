import { marketingBrief, PLAYBOOK_VERSION } from "../agents/marketing";
import {
  applyChange,
  sourceSchema,
  productionSchema,
  itemSchema,
  type Source,
  DomainError,
  requireEdit,
  validateSave,
  type Production,
  type Change,
  idSchema,
} from "../domain/models";
import { digest, Repository } from "./repository";
export class StudioService {
  constructor(
    public repository: Repository,
    public actorId: string,
  ) {}
  async workspaces() {
    return this.repository.list(this.actorId);
  }
  async createWorkspace(id: string, name: string) {
    idSchema.parse(id);
    if (!name.trim() || name.length > 120)
      throw new DomainError("VALIDATION", 400, "Invalid workspace name.");
    return this.repository.create(this.actorId, name.trim(), id);
  }
  async page(workspaceId: string, limit = 20, cursor?: string, query = "") {
    await this.repository.role(workspaceId, this.actorId);
    return this.repository.pageProductions(workspaceId, limit, cursor, query);
  }
  async historyPage(
    workspaceId: string,
    id: string,
    limit: number,
    before?: number,
  ) {
    await this.repository.role(workspaceId, this.actorId);
    if (!(await this.repository.get(workspaceId, id)))
      throw new DomainError("NOT_FOUND", 404, "Production not found.");
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
  async sources(workspaceId: string) {
    await this.repository.role(workspaceId, this.actorId);
    return this.repository.sources(workspaceId);
  }
  async addSource(
    workspaceId: string,
    input: Pick<Source, "name" | "kind" | "reference" | "body">,
  ) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    const data = sourceSchema.parse(input);
    return this.repository.addSource({
      ...data,
      id: crypto.randomUUID(),
      workspaceId,
      createdAt: new Date().toISOString(),
      hash: await digest(data.body),
    });
  }
  async changes(workspaceId: string) {
    await this.repository.role(workspaceId, this.actorId);
    return this.repository.changes(workspaceId);
  }
  async detail(workspaceId: string, id: string) {
    await this.repository.role(workspaceId, this.actorId);
    const production = await this.repository.get(workspaceId, id);
    if (!production)
      throw new DomainError("NOT_FOUND", 404, "Production not found.");
    return {
      production,
      history: await this.repository.history(workspaceId, id),
    };
  }
  async read(workspaceId: string) {
    await this.repository.role(workspaceId, this.actorId);
    return this.repository.listProductions(workspaceId);
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
    const hash = await digest(JSON.stringify({ id, data, baseRevision }));
    const replay = await this.repository.receipt(workspaceId, key, hash);
    if (replay) return replay;
    validateSave(
      await this.repository.get(workspaceId, id),
      data,
      baseRevision,
    );
    return this.repository.save(
      workspaceId,
      id,
      data,
      baseRevision,
      key,
      hash,
      this.actorId,
    );
  }
  async apply(workspaceId: string, id: string) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    const c = await this.repository.change(workspaceId, id);
    const current = await this.repository.get(workspaceId, c.productionId);
    if (!current)
      throw new DomainError("NOT_FOUND", 404, "Production not found.");
    const hash = await digest(JSON.stringify({ apply: id })),
      key = "apply_" + id;
    const replay = await this.repository.receipt(workspaceId, key, hash);
    if (replay) return replay;
    const data = applyChange(current, c);
    return this.repository.save(
      workspaceId,
      current.id,
      data,
      current.revision,
      key,
      hash,
      this.actorId,
    );
  }
  async proposedTarget(
    workspaceId: string,
    id: string,
    itemId: string,
    revision: number,
  ) {
    requireEdit(await this.repository.role(workspaceId, this.actorId));
    const p = await this.repository.get(workspaceId, id);
    if (!p) throw new DomainError("NOT_FOUND", 404, "Production not found.");
    if (p.revision !== revision)
      throw new DomainError("CONFLICT", 409, "Reload the current revision.");
    const item = p.data.items.find((i) => i.id === itemId);
    if (!item) throw new DomainError("NOT_FOUND", 404, "Item not found.");
    if (item.locked)
      throw new DomainError("LOCKED", 409, "This item is locked.");
    return { production: p, item };
  }
}
export type GenerationProvider = {
  revise(input: {
    title: string;
    kind: import("../domain/models").ContentItem["kind"];
    playbookVersion: string;
    brief: ReturnType<typeof marketingBrief>;
    sourceCoverage: { selected: number; truncated: boolean };
    locale: string;
    body: string;
    instruction: string;
    sources: { id: string; body: string }[];
  }): Promise<string>;
};
export async function generateProposal(
  service: StudioService,
  provider: GenerationProvider,
  workspaceId: string,
  input: {
    productionId: string;
    itemId: string;
    baseRevision: number;
    instruction: string;
    idempotencyKey: string;
  },
): Promise<Change> {
  const target = await service.proposedTarget(
    workspaceId,
    input.productionId,
    input.itemId,
    input.baseRevision,
  );
  const hash = await digest(JSON.stringify(input));
  const replay = await service.repository.claimGeneration(
    workspaceId,
    input.idempotencyKey,
    hash,
  );
  if (replay) return replay;
  try {
    const available = await service.repository.sources(workspaceId);
    const sources = available.slice(0, 8);
    const after = await provider.revise({
      title: target.production.data.title,
      kind: target.item.kind,
      playbookVersion: PLAYBOOK_VERSION,
      brief: marketingBrief(target.production.data),
      sourceCoverage: {
        selected: sources.length,
        truncated:
          available.length > 8 || sources.some((s) => s.body.length > 10000),
      },
      locale: target.item.locale,
      body: target.item.body,
      instruction: input.instruction,
      sources: sources.map((s) => ({ id: s.id, body: s.body.slice(0, 10000) })),
    });
    itemSchema.shape.body.parse(after);
    return await service.repository.finishGeneration(
      {
        id: crypto.randomUUID(),
        workspaceId,
        productionId: input.productionId,
        itemId: input.itemId,
        baseRevision: input.baseRevision,
        before: target.item.body,
        after,
        instruction: input.instruction,
        sourceIds: sources.map((s) => s.id),
        createdAt: new Date().toISOString(),
      },
      input.idempotencyKey,
    );
  } catch (e) {
    await service.repository.failGeneration(workspaceId, input.idempotencyKey);
    throw e;
  }
}
