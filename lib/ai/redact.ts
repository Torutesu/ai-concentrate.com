/**
 * Removes credentials and direct contact data from reference material before
 * it leaves the system. Applied to retrieved sources only: the draft being
 * edited is the user's own text and may legitimately contain a contact address.
 */
const PATTERNS: [kind: string, pattern: RegExp][] = [
  [
    "private_key",
    /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  ],
  ["api_key", /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}/g],
  ["api_key", /\bAKIA[0-9A-Z]{16}\b/g],
  ["api_key", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g],
  ["api_key", /\bxox[abprs]-[A-Za-z0-9-]{10,}/g],
  ["api_key", /\bAIza[0-9A-Za-z_-]{35}\b/g],
  ["token", /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g],
  ["email", /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g],
  [
    "phone",
    /(?<![\d-])(?:\+81[-\s]?|0)\d{1,4}[-\s]\d{1,4}[-\s]\d{3,4}(?![\d-])/g,
  ],
];

export function redact(text: string) {
  let count = 0;
  let result = text;
  for (const [kind, pattern] of PATTERNS)
    result = result.replace(pattern, () => {
      count++;
      return `[REDACTED:${kind}]`;
    });
  return { text: result, count };
}

/** Kinds found, for warning at import time (no values are returned). */
export function detectSensitive(text: string) {
  return [
    ...new Set(
      PATTERNS.filter(([, pattern]) => {
        pattern.lastIndex = 0;
        const found = pattern.test(text);
        pattern.lastIndex = 0;
        return found;
      }).map(([kind]) => kind),
    ),
  ];
}
