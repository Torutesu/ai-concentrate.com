import type { BrandProfile } from "../domain/settings";

/** Editable form state; list fields are plain text so typing is never fought. */
export type ProfileDraft = {
  voice: string;
  glossary: { term: string; preferred: string; avoid: string }[];
  claims: string;
};

export function profileToDraft(profile: BrandProfile): ProfileDraft {
  return {
    voice: profile.voice,
    glossary: profile.glossary.map((g) => ({
      term: g.term,
      preferred: g.preferred,
      avoid: g.avoid.join(", "),
    })),
    claims: profile.prohibitedClaims.join("\n"),
  };
}

const unique = (values: string[]) => [...new Set(values)];

/**
 * Converts the form to the stored profile: trims, drops empty rows and
 * duplicates, and splits avoid-lists on commas (ASCII or Japanese).
 */
export function draftToProfile(draft: ProfileDraft): BrandProfile {
  const seen = new Set<string>();
  return {
    voice: draft.voice.trim(),
    glossary: draft.glossary
      .map((g) => ({
        term: g.term.trim(),
        preferred: g.preferred.trim(),
        avoid: unique(
          g.avoid
            .split(/[,、，]/)
            .map((a) => a.trim())
            .filter(Boolean),
        ).slice(0, 10),
      }))
      .filter((g) => g.term && !seen.has(g.term) && seen.add(g.term)),
    prohibitedClaims: unique(
      draft.claims
        .split("\n")
        .map((c) => c.trim())
        .filter(Boolean),
    ),
  };
}

export const sameProfile = (a: BrandProfile, b: BrandProfile) =>
  JSON.stringify(a) === JSON.stringify(b);

/** Display helpers for the usage panel. */
export function formatTokens(n: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    notation: n >= 100_000 ? "compact" : "standard",
    maximumFractionDigits: 1,
  }).format(n);
}
export function formatUsd(micros: number, locale: string) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: micros > 0 && micros < 10_000 ? 4 : 2,
  }).format(micros / 1_000_000);
}
export const cacheRate = (input: number, cached: number) =>
  input > 0 ? Math.round((cached / input) * 100) : 0;
