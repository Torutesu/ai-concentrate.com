import { z } from "zod";

const providerId = z.string().regex(/^[a-z][a-z0-9-]{1,30}$/);

/** Owner-controlled data and automation policy for a workspace. */
export const aiPolicySchema = z
  .object({
    /** Providers that may receive this workspace's content. Omitted = all configured. */
    allowedProviders: z.array(providerId).max(8).optional(),
    /** "none" keeps source documents out of every AI request. */
    sendSources: z.enum(["all", "none"]).default("all"),
    /**
     * Whether external agents (MCP/CLI tokens) may apply proposals without a
     * person. "own_proposals" allows applying only proposals the same client made.
     */
    agentApply: z.enum(["never", "own_proposals", "any"]).default("never"),
  })
  .strict();

/** Brand knowledge every AI request receives (small and stable → cacheable). */
export const profileSchema = z
  .object({
    voice: z.string().max(2000).default(""),
    glossary: z
      .array(
        z
          .object({
            term: z.string().trim().min(1).max(100),
            preferred: z.string().max(200).default(""),
            avoid: z.array(z.string().max(100)).max(10).default([]),
          })
          .strict(),
      )
      .max(100)
      .default([]),
    prohibitedClaims: z
      .array(z.string().trim().min(1).max(300))
      .max(50)
      .default([]),
  })
  .strict();

export const settingsSchema = z
  .object({
    policy: aiPolicySchema.default({}),
    profile: profileSchema.default({}),
  })
  .strict();
export type WorkspaceSettings = z.infer<typeof settingsSchema>;
export type AiPolicy = WorkspaceSettings["policy"];
export type BrandProfile = WorkspaceSettings["profile"];

export const settingsPatchSchema = z
  .object({
    policy: aiPolicySchema.partial().strict().optional(),
    profile: profileSchema.partial().strict().optional(),
  })
  .strict();

/** Stored JSON may predate fields; parsing fills defaults instead of failing. */
export function parseSettings(
  raw: string | null | undefined,
): WorkspaceSettings {
  try {
    const parsed = settingsSchema.safeParse(JSON.parse(raw || "{}"));
    if (parsed.success) return parsed.data;
  } catch {}
  return settingsSchema.parse({});
}
