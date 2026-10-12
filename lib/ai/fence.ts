/** Section tags the prompts use to separate trusted rules from untrusted data. */
const TAGS = [
  "workspace_profile",
  "sources",
  "source",
  "brief",
  "current_text",
  "instruction",
];
const OPEN = new RegExp(`<(/?)(${TAGS.join("|")})(?=[\\s>/])`, "gi");
const MARKED = new RegExp(`<(/?)\u200b(${TAGS.join("|")})`, "gi");

/**
 * Stops untrusted text from closing or opening the prompt's own sections
 * (e.g. a source containing "</sources><workspace_profile>"). A zero-width
 * space after "<" keeps the text readable while breaking the tag.
 */
export const fence = (text: string) => text.replace(OPEN, "<$1\u200b$2");
/** Reverses `fence` in model output so edits apply to the original text. */
export const unfence = (text: string) => text.replace(MARKED, "<$1$2");
