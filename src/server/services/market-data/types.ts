import type { SupportedCurrency } from "@/domain/currency";
import { PriceFetchFailure } from "@/server/actions/types";

export type Exchange = "US" | "WA";
export type MarketDataMode = "user-refresh" | "snapshot";
export type MarketDataProvider = "yahoo" | "finnhub";
export type CacheStatus = "hit" | "miss" | "stale-if-error" | "bypass";

export type GetPricesInput = {
  symbols: string[];
  exchange: Exchange;
  mode: MarketDataMode;
  operationId: string;
};

export type MarketPrice = {
  symbol: string;
  price: number;
  currency: SupportedCurrency;
  provider: MarketDataProvider;
  fetchedAt: string;
  cacheStatus: CacheStatus;
};

export type MarketPriceResultData = {
  prices: MarketPrice[];
  failures: PriceFetchFailure[];
};

export type ProviderConfig = {
  mode: MarketDataMode,
  operationId: string,
}

export type LogLevels = "info" | "warn" | "error";

export type CacheConfig = {
  url: string;
  token: string;
};

export type CacheContext = {
  operationId: string;
  mode: MarketDataMode;
  provider: MarketDataProvider;
  symbol: string;
  exchange: Exchange;
};

export type RetryContext = {
  operationId: string;
  provider: MarketDataProvider;
  symbol: string;
  exchange: Exchange;
  mode: MarketDataMode;
  [key: string]: unknown;
}

export type NoRetryConfig = {
  kind: "no-retry";
  timeoutMs: number;
}

export type RetryWithBackoffConfig = {
  kind: "retry-with-backoff"
  attempts: number;
  timeoutMs: number;
  baseDelayMs: number;
}

export type RetryConfig = NoRetryConfig | RetryWithBackoffConfig;
