import { z } from "zod";
import { DomainError } from "./errors";
import { utf8Bytes } from "./hash";
import { LIMITS } from "./limits";
export { DomainError } from "./errors";

export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const localeSchema = z.enum(["ja", "en"]);
export const roleSchema = z.enum(["owner", "editor", "viewer"]);
export type Role = z.infer<typeof roleSchema>;
const itemKindSchema = z.enum([
  "draft",
  "x",
  "article",
  "reddit",
  "scene",
  "step",
]);
const dateSchema = z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/);
const bodyWithinBudget = z
  .string()
  .refine((v) => utf8Bytes(v) <= LIMITS.itemBodyBytes, {
    message: `Body exceeds ${LIMITS.itemBodyBytes} bytes.`,
  });

export const itemSchema = z
  .object({
    id: idSchema,
    kind: itemKindSchema,
    locale: localeSchema,
    title: z.string().max(200),
    body: bodyWithinBudget,
    locked: z.boolean(),
  })
  .strict();
export type ContentItem = z.infer<typeof itemSchema>;

const briefShape = {
  title: z.string().trim().min(1).max(200),
  persona: z.string().max(1000),
  problem: z.string().max(2000),
  claim: z.string().max(2000),
  hypothesis: z.string().max(3000),
  cta: z.string().max(500),
  destination: z.string().max(2000),
  metric: z.string().max(500),
  evaluationDate: dateSchema,
  plannedDate: dateSchema,
  decision: z.string().max(3000),
};
export const briefKeys = Object.keys(briefShape) as (keyof typeof briefShape)[];

function checkBrief(
  v: Partial<Record<keyof typeof briefShape, string>>,
  ctx: z.RefinementCtx,
) {
  for (const key of ["evaluationDate", "plannedDate"] as const) {
    const d = v[key];
    if (
      d &&
      (Number.isNaN(Date.parse(d)) ||
        new Date(d).toISOString().slice(0, 10) !== d)
    )
      ctx.addIssue({ code: "custom", path: [key], message: "Invalid date" });
  }
  if (v.destination) {
    try {
      const u = new URL(v.destination);
      if (!["https:", "http:"].includes(u.protocol)) throw Error();
    } catch {
      ctx.addIssue({
        code: "custom",
        path: ["destination"],
        message: "Use an HTTP(S) URL",
      });
    }
  }
}

/** Write-time validation: structure, field limits and the aggregate byte budget. */
export const productionSchema = z
  .object({
    ...briefShape,
    items: z.array(itemSchema).min(1).max(LIMITS.items),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.items.map((i) => i.id)).size !== v.items.length)
      ctx.addIssue({ code: "custom", message: "Duplicate item IDs" });
    checkBrief(v, ctx);
  });
export type Production = z.infer<typeof productionSchema>;

export const briefPatchSchema = z
  .object(briefShape)
  .partial()
  .strict()
  .superRefine(checkBrief)
  .refine((v) => Object.keys(v).length > 0, { message: "No fields to update" });

/**
 * Read-time parsing keeps only the structure. Limits are enforced on writes so
 * tightening a limit never makes previously stored productions unreadable.
 */
const storedProductionSchema = z
  .object({
    ...Object.fromEntries(briefKeys.map((k) => [k, z.string()])),
    items: z.array(
      z.object({
        id: z.string(),
        kind: itemKindSchema,
        locale: localeSchema,
        title: z.string(),
        body: z.string(),
        locked: z.boolean(),
      }),
    ),
  })
  .passthrough();
export function parseStoredProduction(json: string): Production {
  return storedProductionSchema.parse(
    JSON.parse(json),
  ) as unknown as Production;
}

/** Throws AGGREGATE_TOO_LARGE before anything is written. */
export function assertAggregateBudget(p: Production) {
  const bytes = utf8Bytes(JSON.stringify(p));
  if (bytes > LIMITS.aggregateBytes)
    throw new DomainError(
      "AGGREGATE_TOO_LARGE",
      413,
      `This production would be ${bytes} bytes; the limit is ${LIMITS.aggregateBytes}. Split it or shorten items.`,
    );
  return bytes;
}

export type VersionedProduction = {
  id: string;
  workspaceId: string;
  revision: number;
  data: Production;
  updatedAt: string;
};
export type Workspace = { id: string; name: string; role: Role };
export const sourceSchema = z
  .object({
    name: z.string().trim().min(1).max(200),
    kind: z.enum(["markdown", "url", "repository"]),
    reference: z.string().max(2000),
    body: z.string().min(1).max(LIMITS.sourceChars),
  })
  .strict();
export type Source = z.infer<typeof sourceSchema> & {
  id: string;
  workspaceId: string;
  createdAt: string;
  hash: string;
};
/** List representation: no body, so listing never transfers whole documents. */
export type SourceSummary = Omit<Source, "body"> & {
  chars: number;
  preview: string;
  truncated: boolean;
  aiExcluded: boolean;
};
export const saveSchema = z
  .object({
    baseRevision: z.number().int().nonnegative(),
    idempotencyKey: idSchema,
    data: productionSchema,
  })
  .strict();
export const proposalSchema = z
  .object({
    productionId: idSchema,
    itemId: idSchema,
    baseRevision: z.number().int().positive(),
    instruction: z.string().trim().min(1).max(2000),
    idempotencyKey: idSchema,
  })
  .strict();

export const changeStatusSchema = z.enum([
  "proposed",
  "applied",
  "rejected",
  "stale",
]);
export type ChangeStatus = z.infer<typeof changeStatusSchema>;
export type ChangeOrigin =
  | {
      kind: "server_ai";
      task: string;
      taskVersion: string;
      provider: string;
      model: string;
      runId: string;
      sourceChunkIds: string[];
      contextHash: string;
    }
  | {
      kind: "client_agent";
      clientId: string | null;
      declaredModel?: string;
      rationale?: string;
    };
export type Change = {
  id: string;
  workspaceId: string;
  productionId: string;
  itemId: string;
  baseRevision: number;
  /** SHA-256 of `before`; absent on proposals created before 2026-10-03. */
  beforeHash?: string;
  before: string;
  after: string;
  instruction: string;
  sourceIds: string[];
  createdAt: string;
  createdBy?: string;
  status: ChangeStatus;
  origin?: ChangeOrigin;
  /** Facts in the proposal that were not found in its inputs. Review before applying. */
  warnings: string[];
  decidedBy?: string;
  decidedAt?: string;
  appliedRevision?: number;
};
export type ChangeSummary = Pick<
  Change,
  | "id"
  | "productionId"
  | "itemId"
  | "baseRevision"
  | "status"
  | "createdAt"
  | "warnings"
> & { originKind: string; preview: string };

export function requireEdit(role: Role) {
  if (role === "viewer")
    throw new DomainError("FORBIDDEN", 403, "Editing is not permitted.");
}
export function requireOwner(role: Role) {
  if (role !== "owner")
    throw new DomainError("FORBIDDEN", 403, "Only an owner can do this.");
}
export function validateSave(
  current: VersionedProduction | null,
  data: Production,
  baseRevision: number,
) {
  if ((current?.revision ?? 0) !== baseRevision)
    throw new DomainError(
      "CONFLICT",
      409,
      "A newer revision exists. Reload before saving.",
    );
  if (current)
    for (const old of current.data.items) {
      const next = data.items.find((i) => i.id === old.id);
      if (old.locked && (!next || next.body !== old.body))
        throw new DomainError(
          "LOCKED",
          409,
          "Unlock the item in a separate save before editing.",
        );
    }
}
/**
 * Three-way check: a proposal stays applicable while its target text is
 * unchanged, even if other items or the brief were edited meanwhile.
 */
export function applyChange(
  current: VersionedProduction,
  change: Change,
  currentItemHash: string,
  changeBeforeHash: string,
): Production {
  if (
    current.workspaceId !== change.workspaceId ||
    current.id !== change.productionId
  )
    throw new DomainError("NOT_FOUND", 404, "Target not found.");
  if (change.status !== "proposed")
    throw new DomainError(
      "CHANGE_CLOSED",
      409,
      `This proposal is already ${change.status}.`,
    );
  const item = current.data.items.find((x) => x.id === change.itemId);
  if (!item) throw new DomainError("NOT_FOUND", 404, "Item not found.");
  if (item.locked) throw new DomainError("LOCKED", 409, "This item is locked.");
  if (currentItemHash !== changeBeforeHash)
    throw new DomainError(
      "CONFLICT",
      409,
      "The target text changed after this proposal was made.",
    );
  return {
    ...current.data,
    items: current.data.items.map((x) =>
      x.id === item.id ? { ...x, body: change.after } : x,
    ),
  };
}

export type ProductionSummary = {
  id: string;
  workspaceId: string;
  revision: number;
  title: string;
  plannedDate: string;
  itemCount: number;
  updatedAt: string;
};
/** Item metadata without the body; agents fetch bodies one at a time. */
export type ItemSummary = Omit<ContentItem, "body"> & {
  chars: number;
  hash: string;
};
