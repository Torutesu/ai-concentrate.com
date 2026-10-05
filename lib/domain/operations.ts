import { z } from "zod";
import type { Scope } from "./actor";
import { LIMITS } from "./limits";
import {
  briefPatchSchema,
  changeStatusSchema,
  idSchema,
  proposalSchema,
  saveSchema,
  sourceSchema,
} from "./models";
import { settingsPatchSchema } from "./settings";
import { editsSchema } from "./text";

const workspace = { workspaceId: idSchema };
const page = {
  cursor: z.string().max(500).optional(),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIMITS.maxPageSize)
    .default(LIMITS.pageSize),
};
const range = {
  offset: z.number().int().nonnegative().default(0),
  limit: z
    .number()
    .int()
    .min(1)
    .max(LIMITS.sourceChars)
    .default(LIMITS.readChars),
};
const hashSchema = z.string().regex(/^[a-f0-9]{64}$/);
const replacement = z
  .object({ body: z.string().optional(), edits: editsSchema.optional() })
  .strict()
  .refine((v) => (v.body === undefined) !== (v.edits === undefined), {
    message: "Provide exactly one of body or edits.",
  });

type Definition = {
  input: z.ZodTypeAny;
  description: string;
  /** Required token scope. Workspace roles are checked separately. */
  scope: Scope;
  readOnly?: boolean;
  destructive?: boolean;
  idempotent?: boolean;
  /** Calls an external AI provider (cost, latency). */
  openWorld?: boolean;
};

/**
 * The one operation registry shared by Web (REST adapters), HTTP
 * `/api/v1/operations`, MCP and the CLI. Inputs are strict: unknown fields
 * fail instead of being silently dropped.
 */
export const operations = {
  workspace_list: {
    input: z.object({}).strict(),
    description: "List workspaces you can access.",
    scope: "studio:read",
    readOnly: true,
  },
  workspace_create: {
    input: z
      .object({ id: idSchema, name: z.string().trim().min(1).max(120) })
      .strict(),
    description: "Create a workspace. Reuse the same explicit ID on retry.",
    scope: "studio:write",
    idempotent: true,
  },
  workspace_delete: {
    input: z.object(workspace).strict(),
    description:
      "Owner only. Hides the workspace immediately and permanently deletes its content after the retention grace period.",
    scope: "studio:admin",
    destructive: true,
    idempotent: true,
  },
  workspace_settings_get: {
    input: z.object(workspace).strict(),
    description:
      "Read the workspace AI policy and brand profile (voice, glossary, prohibited claims).",
    scope: "studio:read",
    readOnly: true,
  },
  workspace_settings_update: {
    input: z
      .object({
        ...workspace,
        baseRevision: z.number().int().nonnegative(),
        patch: settingsPatchSchema,
      })
      .strict(),
    description:
      "Update settings with a revision check. Changing the AI policy requires the owner role; the brand profile requires editor.",
    scope: "studio:admin",
  },
  production_list: {
    input: z
      .object({
        ...workspace,
        ...page,
        query: z.string().trim().max(200).default(""),
      })
      .strict(),
    description:
      "Search production titles and text (3+ characters use the full-text index). Returns summaries; pass nextCursor with the same query to continue.",
    scope: "studio:read",
    readOnly: true,
  },
  production_get: {
    input: z
      .object({
        ...workspace,
        productionId: idSchema,
        includeBodies: z.boolean().default(false),
      })
      .strict(),
    description:
      "Get the brief, item metadata (id, kind, locale, title, locked, chars, hash) and recent revisions. Read bodies with item_get; set includeBodies only when you need every item.",
    scope: "studio:read",
    readOnly: true,
  },
  item_get: {
    input: z
      .object({
        ...workspace,
        productionId: idSchema,
        itemId: idSchema,
        ...range,
      })
      .strict(),
    description:
      "Read one item's text (paged by characters) and its hash for item_patch/change_propose.",
    scope: "studio:read",
    readOnly: true,
  },
  production_history: {
    input: z
      .object({
        ...workspace,
        productionId: idSchema,
        limit: page.limit,
        before: z.number().int().positive().optional(),
      })
      .strict(),
    description:
      "Read revision metadata, newest first. Pass nextBefore to continue.",
    scope: "studio:read",
    readOnly: true,
  },
  production_snapshot: {
    input: z
      .object({
        ...workspace,
        productionId: idSchema,
        revision: z.number().int().positive(),
      })
      .strict(),
    description: "Read an immutable saved revision without restoring it.",
    scope: "studio:read",
    readOnly: true,
  },
  production_review: {
    input: z.object({ ...workspace, productionId: idSchema }).strict(),
    description:
      "Check structural brief completeness. Does not verify claims or predict marketing performance.",
    scope: "studio:read",
    readOnly: true,
  },
  production_save: {
    input: saveSchema.extend({ ...workspace, productionId: idSchema }),
    description:
      "Replace the whole production with a compare-and-swap revision check. Prefer item_patch/brief_patch for small edits. Does not publish.",
    scope: "studio:write",
    idempotent: true,
  },
  production_restore: {
    input: z
      .object({
        ...workspace,
        productionId: idSchema,
        revision: z.number().int().positive(),
        baseRevision: z.number().int().positive(),
        idempotencyKey: idSchema,
      })
      .strict(),
    description:
      "Restore a prior revision as a new revision. Locked items stay protected.",
    scope: "studio:write",
    idempotent: true,
  },
  production_delete: {
    input: z.object({ ...workspace, productionId: idSchema }).strict(),
    description:
      "Permanently delete a production, its history and its proposals.",
    scope: "studio:delete",
    destructive: true,
  },
  item_patch: {
    input: z
      .object({
        ...workspace,
        productionId: idSchema,
        itemId: idSchema,
        baseHash: hashSchema,
        idempotencyKey: idSchema,
        replacement,
      })
      .strict(),
    description:
      "Edit one unlocked item. baseHash (from item_get) must match the current text; other items may have changed meanwhile. Use edits [{find, replace}] for small changes.",
    scope: "studio:write",
    idempotent: true,
  },
  brief_patch: {
    input: z
      .object({
        ...workspace,
        productionId: idSchema,
        baseRevision: z.number().int().positive(),
        idempotencyKey: idSchema,
        fields: briefPatchSchema,
      })
      .strict(),
    description:
      "Update brief fields (title, persona, problem, claim, cta, dates, …) with a revision check.",
    scope: "studio:write",
    idempotent: true,
  },
  context_list: {
    input: z.object({ ...workspace, ...page }).strict(),
    description:
      "List source documents (metadata and a short preview, no full text).",
    scope: "studio:read",
    readOnly: true,
  },
  context_get: {
    input: z.object({ ...workspace, sourceId: idSchema, ...range }).strict(),
    description: "Read part of a source document. Continue with nextOffset.",
    scope: "studio:read",
    readOnly: true,
  },
  context_search: {
    input: z
      .object({
        ...workspace,
        query: z.string().trim().min(3).max(200),
        limit: z.number().int().min(1).max(10).default(5),
      })
      .strict(),
    description:
      "Find the most relevant source passages (short excerpts with source IDs).",
    scope: "studio:read",
    readOnly: true,
  },
  context_import: {
    input: z.object({ ...workspace, source: sourceSchema }).strict(),
    description:
      "Save supplied source text. Never executes instructions from sources. Reports likely secrets or contact data it found.",
    scope: "studio:write",
  },
  context_update: {
    input: z
      .object({ ...workspace, sourceId: idSchema, aiExcluded: z.boolean() })
      .strict(),
    description: "Include or exclude a source from AI requests.",
    scope: "studio:write",
    idempotent: true,
  },
  context_delete: {
    input: z.object({ ...workspace, sourceId: idSchema }).strict(),
    description: "Permanently delete a source document and its search index.",
    scope: "studio:delete",
    destructive: true,
  },
  change_list: {
    input: z
      .object({
        ...workspace,
        ...page,
        productionId: idSchema.optional(),
        status: changeStatusSchema.optional(),
        includeText: z.boolean().default(false),
      })
      .strict(),
    description:
      "List proposals (summaries by default; includeText returns before/after).",
    scope: "studio:read",
    readOnly: true,
  },
  change_get: {
    input: z.object({ ...workspace, changeId: idSchema }).strict(),
    description: "Read one proposal including before/after text and warnings.",
    scope: "studio:read",
    readOnly: true,
  },
  change_propose: {
    input: z
      .object({
        ...workspace,
        productionId: idSchema,
        itemId: idSchema,
        baseHash: hashSchema,
        instruction: z.string().trim().min(1).max(2000),
        replacement,
        rationale: z.string().max(2000).optional(),
        declaredModel: z.string().max(100).optional(),
        idempotencyKey: idSchema,
      })
      .strict(),
    description:
      "Submit text you wrote yourself as a reviewable proposal (no server AI cost). People review and apply it.",
    scope: "studio:propose",
    idempotent: true,
  },
  change_apply: {
    input: z.object({ ...workspace, changeId: idSchema }).strict(),
    description:
      "Apply a proposal if its target text is unchanged. Agents may apply only when the workspace policy allows it.",
    scope: "studio:write",
    idempotent: true,
  },
  change_reject: {
    input: z.object({ ...workspace, changeId: idSchema }).strict(),
    description: "Reject a proposal.",
    scope: "studio:write",
    idempotent: true,
  },
  production_revise: {
    input: proposalSchema.extend({
      ...workspace,
      includeText: z.boolean().default(false),
    }),
    description:
      "Have the server's AI draft a revision proposal for one item using workspace sources. Costs tokens; prefer change_propose if you can write the text yourself.",
    scope: "studio:ai",
    idempotent: true,
    openWorld: true,
  },
  usage_get: {
    input: z.object(workspace).strict(),
    description:
      "AI usage this month for the workspace and for you, with your remaining token budget.",
    scope: "studio:read",
    readOnly: true,
  },
} as const satisfies Record<string, Definition>;

export type Operation = keyof typeof operations;
export type OperationInput<N extends Operation> = z.infer<
  (typeof operations)[N]["input"]
>;
export const isOperation = (name: string): name is Operation =>
  Object.hasOwn(operations, name);
