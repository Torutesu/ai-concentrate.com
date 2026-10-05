import { z } from "zod";
import { productionSchema, localeSchema } from "../domain/models";
import { unsupportedFacts } from "./warnings";

/** Fixed brief + sources + instruction with checkable expectations. */
export const evalCaseSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    description: z.string(),
    production: productionSchema,
    itemId: z.string(),
    instruction: z.string().min(1),
    sources: z
      .array(z.object({ id: z.string(), body: z.string() }).strict())
      .default([]),
    expect: z
      .object({
        locale: localeSchema,
        maxChars: z.number().int().positive().optional(),
        mustNotContain: z.array(z.string()).default([]),
        mustContainAny: z.array(z.string()).default([]),
        noUnsupportedFacts: z.boolean().default(true),
      })
      .strict(),
  })
  .strict();
export type EvalCase = z.infer<typeof evalCaseSchema>;
export type EvalCheck = { name: string; pass: boolean; detail?: string };

const CJK = /[\u3040-\u30ff\u4e00-\u9fff]/g;
const LETTER = /[\p{L}]/gu;

/**
 * Deterministic checks only. They catch fabricated figures, wrong language,
 * banned phrases and length; they do not judge persuasiveness, which still
 * needs human review of the sample (see docs/marketing-agent-quality.md).
 */
export function scoreRevision(
  c: EvalCase,
  output: string,
): { pass: boolean; checks: EvalCheck[] } {
  const item = c.production.items.find((i) => i.id === c.itemId)!;
  const letters = output.match(LETTER)?.length ?? 0;
  const cjkRatio = letters ? (output.match(CJK)?.length ?? 0) / letters : 0;
  const checks: EvalCheck[] = [
    {
      name: "locale",
      pass: c.expect.locale === "ja" ? cjkRatio >= 0.3 : cjkRatio <= 0.05,
      detail: `cjk ratio ${cjkRatio.toFixed(2)}`,
    },
  ];
  if (c.expect.maxChars)
    checks.push({
      name: "length",
      pass: output.length <= c.expect.maxChars,
      detail: `${output.length} chars`,
    });
  for (const banned of c.expect.mustNotContain)
    checks.push({ name: `avoids "${banned}"`, pass: !output.includes(banned) });
  if (c.expect.mustContainAny.length)
    checks.push({
      name: "required element",
      pass: c.expect.mustContainAny.some((s) => output.includes(s)),
      detail: c.expect.mustContainAny.join(" | "),
    });
  if (c.expect.noUnsupportedFacts) {
    const facts = unsupportedFacts(output, [
      item.body,
      JSON.stringify(c.production),
      c.instruction,
      ...c.sources.map((s) => s.body),
    ]);
    checks.push({
      name: "no unsupported figures/URLs",
      pass: facts.length === 0,
      detail: facts.join(", "),
    });
  }
  return { pass: checks.every((x) => x.pass), checks };
}
