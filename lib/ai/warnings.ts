/**
 * Flags URLs and figures in generated text that do not appear in any input
 * (current text, brief, workspace context). A prompt alone cannot prevent
 * fabricated numbers, so reviewers see these before applying a proposal.
 */
const URL = /https?:\/\/[^\s)>\]」』"'、。]+/g;
const FIGURE =
  /\d+(?:[.,]\d+)*\s*(?:%|％|円|万|億|倍|件|人|社|ドル|USD|x|times|percent)?/g;
const normalize = (text: string) =>
  text
    .normalize("NFKC")
    .replace(/(\d),(?=\d{3}\b)/g, "$1")
    .toLowerCase();

export function unsupportedFacts(output: string, inputs: string[]) {
  const reference = normalize(inputs.join("\n"));
  const text = normalize(output);
  const warnings = new Set<string>();
  for (const url of text.match(URL) ?? [])
    if (!reference.includes(url)) warnings.add(`url:${url}`);
  for (const raw of text.match(FIGURE) ?? []) {
    const figure = raw.replace(/\s+/g, "");
    const digits = figure.replace(/\D/g, "");
    // Single digits ("3 ideas", "step 2") are structure, not claims.
    if (digits.length < 2 && figure === digits) continue;
    if (!reference.includes(figure) && !reference.includes(digits))
      warnings.add(`figure:${figure}`);
  }
  return [...warnings].slice(0, 20);
}
