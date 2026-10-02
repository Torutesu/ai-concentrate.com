// Default runtime is independent Next.js on Vercel. Vite aliases this module to sites.ts.
import { createClient } from "@libsql/client";
import { auth, currentUser } from "@clerk/nextjs/server";
import { LibsqlDatabase } from "./libsql";
import { DomainError } from "../domain/models";
export function authConfigured() {
  return Boolean(
    process.env.CLERK_SECRET_KEY &&
      process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
  );
}
export async function getUser() {
  if (!authConfigured()) return null;
  const { userId } = await auth();
  if (!userId) return null;
  const user = await currentUser();
  if (!user) return null;
  return {
    userId,
    email: user.primaryEmailAddress?.emailAddress ?? "",
    displayName: user.fullName ?? user.username ?? "Member",
  };
}
let db: LibsqlDatabase | undefined;
export function database() {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN)
    throw new DomainError(
      "STORAGE_UNAVAILABLE",
      503,
      "Database is not configured.",
    );
  return (db ??= new LibsqlDatabase(
    createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    }),
  ));
}
export function aiConfig() {
  return {
    OPENAI_API_KEY: process.env.OPENAI_API_KEY,
    OPENAI_MODEL: process.env.OPENAI_MODEL,
  };
}
export const signInPath = () => "/sign-in";
export const signInLabel = "ログイン / アカウント作成";
