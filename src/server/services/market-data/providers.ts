import z from "zod";
import { getFinnhubConfig } from "./config";
import { fetchWithRetry } from "./retry";
import type {
  MarketPrice,
  ProviderConfig,
  RetryConfig,
  RetryContext,
} from "./types";

const yahooPriceSchema = z.object({
  regularMarketPrice: z.number(),
});

const finnhubPriceSchema = z.object({
  c: z.number().positive(),
});

export async function fetchYahooWaPrices(
  symbol: string,
  options: ProviderConfig,
): Promise<
  Omit<MarketPrice, "cacheStatus"> & {
    cacheStatus: ProviderConfig["cacheStatus"];
  }
> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=1d`;

  const requestOptions: RequestInit = {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  };

  const retryConfig: RetryConfig =
    options.mode === "snapshot"
      ? {
          kind: "retry-with-backoff",
          attempts: 5,
          timeoutMs: 15000,
          baseDelayMs: 1000,
        }
      : {
          kind: "no-retry",
          timeoutMs: 5000,
        };

  const retryContext: RetryContext = {
    provider: "yahoo",
    symbol,
    exchange: "WA",
    mode: options.mode,
  };

  const result = await fetchWithRetry(
    url,
    requestOptions,
    retryConfig,
    retryContext,
  );

  if (result.isErr()) {
    throw result.error;
  }

  const response = await result.value.json();
  const parsed = yahooPriceSchema.safeParse(response);

  if (!parsed.success) {
    throw new Error(
      `Yahoo returned invalid price data for symbol "${symbol}": response does not match the expected schema`,
      { cause: parsed.error },
    );
  }

  const marketPrice = {
    symbol,
    price: parsed.data.regularMarketPrice,
    currency: "PLN",
    provider: "yahoo",
    fetchedAt: new Date().toISOString(),
    cacheStatus: options.cacheStatus,
  } satisfies MarketPrice;

  return marketPrice;
}

export async function fetchFinnhubUsPrices(
  symbol: string,
  options: ProviderConfig,
): Promise<
  Omit<MarketPrice, "cacheStatus"> & {
    cacheStatus: ProviderConfig["cacheStatus"];
  }
> {
  const configResult = getFinnhubConfig();

  if (configResult.isErr()) {
    throw configResult.error;
  }

  const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(configResult.value.apiKey)}`;

  const requestOptions: RequestInit = {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  };

  const retryConfig: RetryConfig =
    options.mode === "snapshot"
      ? {
          kind: "retry-with-backoff",
          attempts: 5,
          timeoutMs: 15000,
          baseDelayMs: 1000,
        }
      : {
          kind: "no-retry",
          timeoutMs: 5000,
        };

  const retryContext: RetryContext = {
    provider: "finnhub",
    symbol,
    exchange: "US",
    mode: options.mode,
  };

  const result = await fetchWithRetry(
    url,
    requestOptions,
    retryConfig,
    retryContext,
  );

  if (result.isErr()) {
    throw result.error;
  }

  const response = await result.value.json();
  const parsed = finnhubPriceSchema.safeParse(response);

  if (!parsed.success) {
    throw new Error(
      `Finnhub returned invalid price data for symbol "${symbol}": response does not match the expected schema`,
      { cause: parsed.error },
    );
  }

  const marketPrice = {
    symbol,
    price: parsed.data.c,
    currency: "USD",
    provider: "finnhub",
    fetchedAt: new Date().toISOString(),
    cacheStatus: options.cacheStatus,
  } satisfies MarketPrice;

  return marketPrice;
}
