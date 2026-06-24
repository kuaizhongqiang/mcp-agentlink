/**
 * Retry utility for MCP operations.
 * Provides exponential backoff for transient failures.
 */

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

const DEFAULT_OPTIONS: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
};

/**
 * Execute an async function with retry on failure.
 * Uses exponential backoff with jitter.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options?: Partial<RetryOptions>
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt === opts.maxAttempts) break;

      // Exponential backoff with jitter
      const delay = Math.min(
        opts.baseDelayMs * Math.pow(2, attempt - 1),
        opts.maxDelayMs
      );
      const jitter = delay * 0.1 * Math.random();
      await new Promise((resolve) => setTimeout(resolve, delay + jitter));
    }
  }

  throw lastError!;
}

/**
 * Check if an error is likely transient (network issue, timeout, 5xx).
 */
export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("econnreset") ||
    msg.includes("econnrefused") ||
    msg.includes("etimedout") ||
    msg.includes("enotfound") ||
    msg.includes("socket") ||
    msg.includes("network") ||
    msg.includes("timeout") ||
    msg.includes("5xx") ||
    msg.includes("internal server error")
  );
}
