import { reviewReadiness } from "../agents/marketing";
import { operationSchemas, type Operation } from "../domain/operations";
import {
  StudioService,
  generateProposal,
  type GenerationProvider,
} from "./service";
export async function executeOperation(
  s: StudioService,
  name: Operation,
  input: unknown,
  provider?: GenerationProvider,
) {
  switch (name) {
    case "workspace_list":
      operationSchemas[name].parse(input);
      return s.workspaces();
    case "workspace_create": {
      const p = operationSchemas[name].parse(input);
      return s.createWorkspace(p.id, p.name);
    }
    case "production_list": {
      const p = operationSchemas[name].parse(input);
      return s.page(p.workspaceId, p.limit, p.cursor, p.query);
    }
    case "production_history": {
      const p = operationSchemas[name].parse(input);
      return s.historyPage(p.workspaceId, p.productionId, p.limit, p.before);
    }
    case "production_snapshot": {
      const p = operationSchemas[name].parse(input);
      return s.snapshot(p.workspaceId, p.productionId, p.revision);
    }
    case "production_review": {
      const p = operationSchemas[name].parse(input);
      const detail = await s.detail(p.workspaceId, p.productionId);
      const sources = await s.sources(p.workspaceId);
      return reviewReadiness(detail.production.data, sources.length);
    }
    case "production_get": {
      const p = operationSchemas[name].parse(input);
      return s.detail(p.workspaceId, p.productionId);
    }
    case "production_save": {
      const p = operationSchemas[name].parse(input);
      return s.save(
        p.workspaceId,
        p.productionId,
        p.data,
        p.baseRevision,
        p.idempotencyKey,
      );
    }
    case "production_restore": {
      const p = operationSchemas[name].parse(input);
      return s.restore(
        p.workspaceId,
        p.productionId,
        p.revision,
        p.baseRevision,
        p.idempotencyKey,
      );
    }
    case "context_list": {
      const p = operationSchemas[name].parse(input);
      return s.sources(p.workspaceId);
    }
    case "context_import": {
      const p = operationSchemas[name].parse(input);
      return s.addSource(p.workspaceId, p.source);
    }
    case "change_list": {
      const p = operationSchemas[name].parse(input);
      return s.changes(p.workspaceId);
    }
    case "change_apply": {
      const p = operationSchemas[name].parse(input);
      return s.apply(p.workspaceId, p.changeId);
    }
    case "production_revise": {
      const p = operationSchemas[name].parse(input);
      if (!provider) throw Error("AI provider is not configured.");
      return generateProposal(s, provider, p.workspaceId, p);
    }
  }
}
