export class DomainError extends Error {
  constructor(
    public code: string,
    public status: number,
    message: string,
    /** Seconds the caller should wait before retrying (sent as Retry-After). */
    public retryAfter?: number,
  ) {
    super(message);
  }
}
