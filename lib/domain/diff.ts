export type DiffPart = { type: "same" | "add" | "del"; text: string };

/** LCS cells above this fall back to line granularity, then to one replacement. */
const MAX_CELLS = 2_000_000;
const TOKEN =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]|[\p{L}\p{N}_]+|\s+|[^\s\p{L}\p{N}_]/gu;

const CJK_CHAR =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uff00-\uffef\uac00-\ud7af]/u;
const WORD_CHAR = /[\p{L}\p{N}_]/u;
const isHigh = (s: string, i: number) =>
  s.charCodeAt(i) >= 0xd800 && s.charCodeAt(i) <= 0xdbff;
const isLow = (s: string, i: number) =>
  s.charCodeAt(i) >= 0xdc00 && s.charCodeAt(i) <= 0xdfff;
const words = (text: string) => text.match(TOKEN) ?? [];
const lines = (text: string) => text.match(/[^\n]*\n|[^\n]+$/g) ?? [];

function push(parts: DiffPart[], type: DiffPart["type"], text: string) {
  if (!text) return;
  const last = parts.at(-1);
  if (last?.type === type) last.text += text;
  else parts.push({ type, text });
}

function lcs(a: string[], b: string[], parts: DiffPart[]) {
  const n = a.length,
    m = b.length,
    w = m + 1;
  // table[i][j] = LCS length of a[i:] and b[j:]
  const table = new Uint32Array((n + 1) * w);
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      table[i * w + j] =
        a[i] === b[j]
          ? table[(i + 1) * w + j + 1] + 1
          : Math.max(table[(i + 1) * w + j], table[i * w + j + 1]);
  let i = 0,
    j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      push(parts, "same", a[i]);
      i++;
      j++;
    } else if (table[(i + 1) * w + j] >= table[i * w + j + 1])
      push(parts, "del", a[i++]);
    else push(parts, "add", b[j++]);
  }
  while (i < n) push(parts, "del", a[i++]);
  while (j < m) push(parts, "add", b[j++]);
}

/**
 * Word-level diff for proposal review (CJK compares per character). Common
 * prefix/suffix are trimmed first, so typical edits stay cheap; very large
 * rewrites degrade to line granularity and finally to a single replacement
 * instead of allocating an unbounded table.
 */
export function diffText(before: string, after: string): DiffPart[] {
  const parts: DiffPart[] = [];
  if (before === after) {
    push(parts, "same", before);
    return parts;
  }
  let start = 0;
  const max = Math.min(before.length, after.length);
  while (start < max && before[start] === after[start]) start++;
  let end = 0;
  while (
    end < max - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  )
    end++;
  // Never split a surrogate pair or a Latin word at the trim boundary.
  const inWord = (c: string | undefined) =>
    c !== undefined && WORD_CHAR.test(c) && !CJK_CHAR.test(c);
  while (start > 0 && (inWord(before[start - 1]) || isHigh(before, start - 1)))
    start--;
  while (
    end > 0 &&
    (inWord(before[before.length - end]) || isLow(before, before.length - end))
  )
    end--;
  const head = before.slice(0, start),
    tail = before.slice(before.length - end),
    a = before.slice(start, before.length - end),
    b = after.slice(start, after.length - end);
  push(parts, "same", head);
  const [ta, tb] = [words(a), words(b)];
  if ((ta.length + 1) * (tb.length + 1) <= MAX_CELLS) lcs(ta, tb, parts);
  else {
    const [la, lb] = [lines(a), lines(b)];
    if ((la.length + 1) * (lb.length + 1) <= MAX_CELLS) lcs(la, lb, parts);
    else {
      push(parts, "del", a);
      push(parts, "add", b);
    }
  }
  push(parts, "same", tail);
  return parts;
}

/** Characters added and removed, for a compact summary ("+120 / -45"). */
export function diffStats(parts: DiffPart[]) {
  let added = 0,
    removed = 0;
  for (const p of parts)
    if (p.type === "add") added += p.text.length;
    else if (p.type === "del") removed += p.text.length;
  return { added, removed };
}
