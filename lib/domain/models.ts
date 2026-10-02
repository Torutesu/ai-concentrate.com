import { z } from "zod";

export const idSchema = z.string().regex(/^[a-zA-Z0-9_-]{1,80}$/);
export const localeSchema = z.enum(["ja", "en"]);
export const roleSchema = z.enum(["owner", "editor", "viewer"]);
export type Role = z.infer<typeof roleSchema>;
export const itemSchema = z
  .object({
    id: idSchema,
    kind: z.enum(["draft", "x", "article", "reddit", "scene", "step"]),
    locale: localeSchema,
    title: z.string().max(200),
    body: z.string().max(20000),
    locked: z.boolean(),
  })
  .strict();
export type ContentItem = z.infer<typeof itemSchema>;
export const productionSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    persona: z.string().max(1000),
    problem: z.string().max(2000),
    claim: z.string().max(2000),
    hypothesis: z.string().max(3000),
    cta: z.string().max(500),
    destination: z.string().max(2000),
    metric: z.string().max(500),
    evaluationDate: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
    plannedDate: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/),
    decision: z.string().max(3000),
    items: z.array(itemSchema).min(1).max(100),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.items.map((i) => i.id)).size !== v.items.length)
      ctx.addIssue({ code: "custom", message: "Duplicate item IDs" });
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
  });
export type Production = z.infer<typeof productionSchema>;
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
    body: z.string().min(1).max(60000),
  })
  .strict();
export type Source = z.infer<typeof sourceSchema> & {
  id: string;
  workspaceId: string;
  createdAt: string;
  hash: string;
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
export type Change = {
  id: string;
  workspaceId: string;
  productionId: string;
  itemId: string;
  baseRevision: number;
  before: string;
  after: string;
  instruction: string;
  sourceIds: string[];
  createdAt: string;
};
export class DomainError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function requireEdit(role: Role) {
  if (role === "viewer")
    throw new DomainError("FORBIDDEN", 403, "Editing is not permitted.");
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
export function applyChange(
  current: VersionedProduction,
  change: Change,
): Production {
  if (
    current.workspaceId !== change.workspaceId ||
    current.id !== change.productionId
  )
    throw new DomainError("NOT_FOUND", 404, "Target not found.");
  if (current.revision !== change.baseRevision)
    throw new DomainError(
      "CONFLICT",
      409,
      "The draft changed after this proposal was made.",
    );
  const item = current.data.items.find((x) => x.id === change.itemId);
  if (!item) throw new DomainError("NOT_FOUND", 404, "Item not found.");
  if (item.locked) throw new DomainError("LOCKED", 409, "This item is locked.");
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
