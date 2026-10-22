import type {
  Change,
  ChangeSummary,
  Role,
  Source,
  SourceSummary,
  VersionedProduction,
  Workspace,
} from "./models";
import type { Operation } from "./operations";
import type { WorkspaceSettings } from "./settings";

export type UsageTotals = {
  runs: number;
  inputTokens: number;
  cachedInputTokens: number;
  outputTokens: number;
  /** Estimated provider cost in millionths of a US dollar. */
  costMicros: number;
  billableTokens: number;
};
export type Page<T> = { items: T[]; nextCursor: string | null };

/**
 * Result contracts shared by the server handlers and the Web client. The
 * server's handler map is typed against this, so a changed return shape fails
 * type checking instead of silently breaking a screen.
 */
export type OperationResults = {
  workspace_list: Workspace[];
  workspace_delete: { deleted: boolean; purgeAfterDays: number };
  workspace_settings_get: {
    settings: WorkspaceSettings;
    revision: number;
    role: Role;
  };
  workspace_settings_update: { settings: WorkspaceSettings; revision: number };
  production_delete: { deleted: boolean };
  production_restore: VersionedProduction;
  context_list: Page<SourceSummary>;
  context_get: {
    source: Omit<Source, "body"> & { chars: number };
    text: string;
    offset: number;
    nextOffset: number | null;
  };
  context_search: {
    results: { sourceId: string; chunk: number; excerpt: string }[];
  };
  context_update: { id: string; aiExcluded: boolean };
  context_delete: { deleted: boolean };
  change_list: Page<Change> | Page<ChangeSummary>;
  change_get: Change;
  change_reject: ChangeSummary;
  usage_get: {
    since: string;
    workspace: UsageTotals;
    you: UsageTotals;
    monthlyTokenBudget: number;
    remainingTokens: number;
  };
};
export type OperationResult<N extends Operation> =
  N extends keyof OperationResults ? OperationResults[N] : unknown;
