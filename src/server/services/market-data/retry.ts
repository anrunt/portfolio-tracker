import { Result } from "better-result";
import { logMarketData } from "./logger";
import { RetryConfig, RetryContext } from "./types";
import {
  NonRetryableMarketDataError,
  RetryableMarketDataError,
  type MarketDataProviderError,
} from "@/server/errors";

const RETRY_CODES = [408, 425, 429, 500, 502, 503, 504];

export async function fetchWithRetry(url: string, options: RequestInit, config: RetryConfig, context: RetryContext): Promise<Result<Response, MarketDataProviderError>> {
  if (config.kind === "retry-with-backoff") {
    if (!Number.isInteger(config.attempts) && config.attempts < 2) {
      throw new RangeError("Retry attempts must be an integer greater than 1");
    }

    let currentAttempt = 0;

    const result = await Result.tryPromise(
      {
        try: async ({ attempt }) => {
          currentAttempt = attempt;

          if (attempt > 1) {
            const delayMs = config.baseDelayMs * 2 ** (attempt - 2);

            logMarketData("warn", {
              event: "market_price_provider_retry",
              ...context,
              attempt,
              maxAttempts: config.attempts,
              delayMs,
            });
          }

          const response = await fetch(url, {
            ...options,
            signal: AbortSignal.timeout(config.timeoutMs)
          });

          if (!response.ok) {
            throw createHttpError(response.status, context);
          }

          return response;
        },
        catch: (error) => normalizeMarketDataError(error, context),
      },
      {
        retry: {
          times: config.attempts - 1,
          delayMs: config.baseDelayMs,
          backoff: "exponential",
          shouldRetry: (error) => RetryableMarketDataError.is(error),
        }
      }
    );

    if (Result.isError(result)) {
      const error = result.error;

      logMarketData("error", {
        event: "market_price_provider_failed",
        ...context,
        attempt: currentAttempt,
        maxAttempts: config.attempts,
        status: error.status,
        reason: error.reason,
        error: error.message,
        retryable: RetryableMarketDataError.is(error),
      });
    }

    return result;
  } else {
    return Result.tryPromise({
      try: async () => {
        const response = await fetch(url, {
          ...options,
          signal: AbortSignal.timeout(config.timeoutMs)
        })

        if (!response.ok) {
          throw createHttpError(response.status, context);
        }

        return response;
      },
      catch: (e) => {
        const error = normalizeMarketDataError(e, context);

        logMarketData("error", {
          event: "market_price_provider_failed",
          ...context,
          attempt: 1,
          maxAttempts: 1,
          status: error.status,
          reason: error.reason,
          error: error.message,
          retryable: RetryableMarketDataError.is(error),
        });

        return error;
      }
    })
  }

}

function createHttpError(
  status: number,
  context: RetryContext,
): MarketDataProviderError {
  const details = {
    provider: context.provider,
    symbol: context.symbol,
    status,
  };

  if (status === 429) {
    return new RetryableMarketDataError({
      ...details,
      reason: "rate-limit",
      message: `${context.provider} rate limit exceeded for ${context.symbol}`,
    });
  }

  if (status === 408) {
    return new RetryableMarketDataError({
      ...details,
      reason: "timeout",
      message: `${context.provider} request timed out for ${context.symbol}`,
    });
  }

  if (RETRY_CODES.includes(status)) {
    return new RetryableMarketDataError({
      ...details,
      reason: "provider-unavailable",
      message: `${context.provider} is unavailable (HTTP ${status})`,
    });
  }

  const reason =
    status === 401
      ? "unauthorized"
      : status === 403
        ? "forbidden"
        : status === 404
          ? "symbol-not-found"
          : status >= 400 && status < 500
            ? "bad-request"
            : "invalid-response";

  return new NonRetryableMarketDataError({
    ...details,
    reason,
    message: `${context.provider} request failed with HTTP ${status}`,
  });
}

function normalizeMarketDataError(
  error: unknown,
  context: RetryContext,
): MarketDataProviderError {
  if (
    RetryableMarketDataError.is(error) ||
    NonRetryableMarketDataError.is(error)
  ) {
    return error;
  }

  if (error instanceof DOMException && error.name === "TimeoutError") {
    return new RetryableMarketDataError({
      provider: context.provider,
      symbol: context.symbol,
      reason: "timeout",
      message: `${context.provider} request timed out for ${context.symbol}`,
    });
  }

  if (error instanceof DOMException && error.name === "AbortError") {
    return new NonRetryableMarketDataError({
      provider: context.provider,
      symbol: context.symbol,
      reason: "unexpected",
      message: `${context.provider} request was cancelled for ${context.symbol}`,
    });
  }

  if (error instanceof TypeError) {
    return new RetryableMarketDataError({
      provider: context.provider,
      symbol: context.symbol,
      reason: "network",
      message: `${context.provider} network request failed for ${context.symbol}: ${error.message}`,
    });
  }

  return new NonRetryableMarketDataError({
    provider: context.provider,
    symbol: context.symbol,
    reason: "unexpected",
    message:
      error instanceof Error
        ? error.message
        : `Unexpected market data error: ${String(error)}`,
  });
}
