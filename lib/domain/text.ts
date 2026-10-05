import { z } from "zod";
import { DomainError } from "./errors";

export const editSchema = z
  .object({ find: z.string().min(1).max(4000), replace: z.string().max(16000) })
  .strict();
export type Edit = z.infer<typeof editSchema>;
export const editsSchema = z.array(editSchema).min(1).max(50);

/**
 * Applies find/replace edits in order. Each `find` must occur exactly once in
 * the text as it stands after the previous edits, so an edit can never land in
 * an unintended place.
 */
export function applyEdits(body: string, edits: Edit[]) {
  let result = body;
  edits.forEach((edit, index) => {
    const at = result.indexOf(edit.find);
    if (at < 0)
      throw new DomainError(
        "EDIT_NOT_FOUND",
        422,
        `Edit ${index + 1}: the text to replace was not found.`,
      );
    if (result.indexOf(edit.find, at + 1) >= 0)
      throw new DomainError(
        "EDIT_AMBIGUOUS",
        422,
        `Edit ${index + 1}: the text to replace occurs more than once; include more context.`,
      );
    result =
      result.slice(0, at) + edit.replace + result.slice(at + edit.find.length);
  });
  return result;
}

const CJK =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/gu;

/**
 * Conservative provider-neutral estimate used for budgets, not billing:
 * CJK characters ≈ 1 token each, other text ≈ 4 characters per token.
 */
export function estimateTokens(text: string) {
  const cjk = text.match(CJK)?.length ?? 0;
  return cjk + Math.ceil((text.length - cjk) / 4);
}

const BOUNDARIES = ["\n\n", "\n", "。", "！", "？", ". ", "! ", "? "];

/** Splits text into retrieval chunks, preferring paragraph/sentence boundaries. */
export function chunkText(text: string, target = 1200, max = 1600) {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > max) {
    let cut = -1;
    for (const boundary of BOUNDARIES) {
      const at = rest.lastIndexOf(boundary, max - boundary.length);
      if (at >= target * 0.5) {
        cut = at + boundary.length;
        break;
      }
    }
    if (cut < 0) cut = target;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks.filter(Boolean);
}
