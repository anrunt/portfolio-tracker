import { logMarketData } from "./logger";
import { RetryConfig, RetryContext, RetryWithBackoffConfig } from "./types";

const RETRY_CODES = [408, 425, 429, 500, 502, 503, 504];

export async function fetchWithRetry(url: string, options: RequestInit, retryConfig: RetryConfig, context: RetryContext) {
  for (let i = 0; i < retryConfig.attempts; i++) {
    const attempt = i + 1;

    try {
      const response = await fetch(url, {
        ...options,
        signal: AbortSignal.timeout(retryConfig.timeoutMs)
      })

      if (response.ok) {
        return response;
      }

      if (RETRY_CODES.includes(response.status)) {
        if (i === retryConfig.attempts - 1) {
          logMarketData("error", {
            event: "market_price_provider_failed",
            ...context,
            status: response.status,
            attempt,
            maxAttempts: retryConfig.attempts,
            errorMessage: "No more attempts left, fetch failed"
          });

          throw new Error("Failed to fetch price for: " + context.symbol);

        } else {
          if (retryConfig.kind === "retry-with-backoff") {
            const delay = getRetryDelayMs(i, retryConfig);

            logMarketData("warn", {
              event: "market_price_provider_retry",
              ...context,
              attempt,
              maxAttempts: retryConfig.attempts,
              status: response.status,
              delayMs: Math.round(delay)
            });

            await sleep(delay);
          } 

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

    } catch(error) {
      const hasAttemptsLeft = i < retryConfig.attempts - 1;
      const canRetry = retryConfig.kind === "retry-with-backoff" && hasAttemptsLeft;

      if (canRetry) {
        const delay = getRetryDelayMs(i, retryConfig);

        logMarketData("warn", {
          event: "market_price_provider_retry",
          ...context,
          attempt,
          maxAttempts: retryConfig.attempts,
          delayMs: Math.round(delay),
          catchedError: toErrorMessage(error)
        });

        await sleep(delay);
      } else {
        throw new Error("Unhandled error: ", {cause: error});
      }
    }
  }
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
