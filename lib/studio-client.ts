import type { z } from "zod";
import type { OperationResult } from "./domain/operation-results";
import type { Operation, operations } from "./domain/operations";

export type ApiIssue = { path: string; message: string };
export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    public issues: ApiIssue[] = [],
    public requestId?: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch("/api/v1" + path, {
    ...init,
    signal: init?.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(60000)])
      : AbortSignal.timeout(60000),
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  // Gateways and crashes can answer with HTML; never surface a JSON parse error.
  const data = (await r.json().catch(() => ({}))) as {
    error?: { code?: string; message?: string; issues?: ApiIssue[] };
  };
  if (!r.ok)
    throw new ApiError(
      data.error?.code ?? (r.status >= 500 ? "SERVER" : "UNKNOWN"),
      r.status,
      data.error?.message ?? "Request failed",
      data.error?.issues ?? [],
      r.headers.get("X-Request-Id") ?? undefined,
    );
  return data as T;
}
export const json = (value: unknown) => JSON.stringify(value);

/** Input as the caller writes it (fields with defaults are optional). */
export type OperationArgs<N extends Operation> = z.input<
  (typeof operations)[N]["input"]
>;

/**
 * Calls the shared operation registry, the same contract MCP and the CLI use,
 * so the Web app never needs a bespoke route for a new capability.
 */
export async function operation<N extends Operation>(
  name: N,
  args: OperationArgs<N>,
  init?: Pick<RequestInit, "signal">,
): Promise<OperationResult<N>> {
  const r = await api<{ data: OperationResult<N> }>("/operations", {
    method: "POST",
    body: json({ name, arguments: args }),
    signal: init?.signal,
  });
  return r.data;
}
