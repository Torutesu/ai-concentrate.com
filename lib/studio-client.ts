export class ApiError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await fetch("/api/v1" + path, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const data = (await r.json()) as {
    error?: { code?: string; message?: string };
  };
  if (!r.ok)
    throw new ApiError(
      data.error?.code ?? "UNKNOWN",
      r.status,
      data.error?.message ?? "Request failed",
    );
  return data as T;
}
export const json = (value: unknown) => JSON.stringify(value);
