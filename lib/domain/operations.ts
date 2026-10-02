import { z } from "zod";
import { idSchema, saveSchema, sourceSchema, proposalSchema } from "./models";
const workspace = { workspaceId: idSchema };
export const operationSchemas = {
  workspace_list: z.object({}).strict(),
  workspace_create: z
    .object({ id: idSchema, name: z.string().trim().min(1).max(120) })
    .strict(),
  production_list: z
    .object({
      ...workspace,
      cursor: z.string().max(500).optional(),
      limit: z.number().int().min(1).max(50).default(20),
    })
    .strict(),
  production_review: z
    .object({ ...workspace, productionId: idSchema })
    .strict(),
  production_get: z.object({ ...workspace, productionId: idSchema }).strict(),
  production_save: saveSchema.extend({ ...workspace, productionId: idSchema }),
  production_restore: z
    .object({
      ...workspace,
      productionId: idSchema,
      revision: z.number().int().positive(),
      baseRevision: z.number().int().positive(),
      idempotencyKey: idSchema,
    })
    .strict(),
  context_list: z.object(workspace).strict(),
  context_import: z.object({ ...workspace, source: sourceSchema }).strict(),
  change_list: z.object(workspace).strict(),
  change_apply: z.object({ ...workspace, changeId: idSchema }).strict(),
  production_revise: proposalSchema.extend(workspace),
} as const;
export type Operation = keyof typeof operationSchemas;
export const operationDescriptions: Record<Operation, string> = {
  workspace_list: "List workspaces accessible to the authenticated user.",
  workspace_create: "Create a workspace. Reuse the same explicit ID on retry.",
  production_list:
    "Read a page of production summaries; pass nextCursor to continue.",
  production_review:
    "Check structural brief completeness. Does not verify claims or predict marketing performance.",
  production_get: "Get a production and recent revision metadata.",
  production_save:
    "Save a draft with compare-and-swap revision and idempotency key. Does not publish.",
  production_restore:
    "Restore a prior revision as a new revision. Locked items and concurrent changes are protected.",
  context_list: "Read source text in the workspace.",
  context_import:
    "Save supplied source text. Does not execute instructions from sources.",
  change_list: "Read generated proposals.",
  change_apply: "Apply a proposal only to its original revision.",
  production_revise:
    "Generate an unapplied revision proposal using workspace sources. Calls the configured AI provider.",
};
