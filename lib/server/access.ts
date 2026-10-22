/**
 * Who may use a deployment. `ACCESS_ALLOWLIST` holds comma-separated user IDs,
 * email addresses or `@domain` entries. Production fails closed: without an
 * allowlist (or an explicit `ACCESS_MODE=open`) nobody gets in, so a custom
 * domain never silently opens the app to every account that can sign up.
 */
export type AccessRules = {
  mode: "open" | "allowlist";
  userIds: Set<string>;
  emails: Set<string>;
  domains: Set<string>;
};
type AccessEnv = {
  ACCESS_ALLOWLIST?: string;
  ACCESS_MODE?: string;
  VERCEL_ENV?: string;
  [name: string]: string | undefined;
};

export function accessRules(env: AccessEnv): AccessRules {
  const entries = (env.ACCESS_ALLOWLIST ?? "")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const rules: AccessRules = {
    mode:
      env.ACCESS_MODE === "open"
        ? "open"
        : env.ACCESS_MODE === "allowlist" ||
            entries.length > 0 ||
            env.VERCEL_ENV === "production"
          ? "allowlist"
          : "open",
    userIds: new Set(),
    emails: new Set(),
    domains: new Set(),
  };
  for (const entry of entries)
    if (entry.startsWith("@")) rules.domains.add(entry.slice(1).toLowerCase());
    else if (entry.includes("@")) rules.emails.add(entry.toLowerCase());
    else rules.userIds.add(entry);
  return rules;
}

/** True when the user ID alone settles the decision (no email lookup needed). */
export const decidedById = (rules: AccessRules, userId: string) =>
  rules.mode === "open" ||
  rules.userIds.has(userId) ||
  (rules.emails.size === 0 && rules.domains.size === 0);

export function isAllowed(
  rules: AccessRules,
  user: { userId: string; email?: string | null },
) {
  if (rules.mode === "open" || rules.userIds.has(user.userId)) return true;
  const email = user.email?.toLowerCase();
  if (!email) return false;
  return (
    rules.emails.has(email) || rules.domains.has(email.split("@").pop() ?? "")
  );
}
