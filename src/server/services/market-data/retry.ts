import { logMarketData } from "./logger";
import { RetryConfig, RetryContext, RetryWithBackoffConfig } from "./types";

const RETRY_CODES = [408, 425, 429, 500, 502, 503, 504];

export async function fetchWithRetry(url: string, options: RequestInit, config: RetryConfig, context: RetryContext): Promise<Response> {
  for (let i = 0; i < config.attempts; i++) {
    const attempt = i + 1;
    const hasAttemptsLeft = i < config.attempts - 1;
    const canRetry = config.kind === "retry-with-backoff" && hasAttemptsLeft;

    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(config.timeoutMs)
      })

    } catch(error) {


      if (canRetry) {
        const delay = getRetryDelayMs(i, config);

        logMarketData("warn", {
          event: "market_price_provider_retry",
          ...context,
          attempt,
          maxAttempts: config.attempts,
          delayMs: Math.round(delay),
          error: toErrorMessage(error)
        });

        await sleep(delay);

        continue;
      } else {
        logMarketData("error", {
          event: "market_price_provider_failed",
          ...context,
          attempt,
          maxAttempts: config.attempts,
          error: toErrorMessage(error),
          retryable: true,
        });

        throw new Error("Unhandled error", { cause: error });
      }
    }

    if (response.ok) {
      return response;
    }

    if (RETRY_CODES.includes(response.status)) {
      if (!canRetry) {
        logMarketData("error", {
          event: "market_price_provider_failed",
          ...context,
          status: response.status,
          attempt,
          maxAttempts: config.attempts,
          errorMessage: "No more attempts left, fetch failed"
        });

        throw new Error("Failed to fetch price for: " + context.symbol);

      } else {
        const delay = getRetryDelayMs(i, config);

        logMarketData("warn", {
          event: "market_price_provider_retry",
          ...context,
          attempt,
          maxAttempts: config.attempts,
          status: response.status,
          delayMs: Math.round(delay)
        });

        await sleep(delay);

        continue;
      }
    } else {
      logMarketData("error", {
        event: "market_price_provider_failed",
        ...context,
        status: response.status,
        errorMessage: "Status not for retry"
      });

      throw new Error("Failed to fetch price for: " + context.symbol);
    }
  }

  throw new Error(`fetchWithRetry finished without response for: ${context.symbol}`);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getRetryDelayMs(index: number, config: RetryWithBackoffConfig): number {
  const delay = config.baseDelayMs * Math.pow(2, index);
  const cappedDelay = Math.min(delay, config.maxDelayMs);
  const jitter = Math.random() * config.jitterMs;

  return cappedDelay + jitter;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
