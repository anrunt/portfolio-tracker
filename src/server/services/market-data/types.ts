import { PriceFetchFailure } from "@/server/actions/types";

export type Exchange = "US" | "WA";
export type MarketDataMode = "user-refresh" | "snapshot";
export type MarketDataProvider = "yahoo" | "finnhub";
export type MarketCurrency = "USD" | "PLN";
export type CacheStatus = "hit" | "miss" | "stale-if-error" | "bypass";

export type GetPricesInput = {
  symbols: string[];
  exchange: Exchange;
  mode: MarketDataMode;
  operationId?: string;
};

export type MarketPrice = {
  symbol: string;
  price: number;
  currency: MarketCurrency;
  provider: MarketDataProvider;
  fetchedAt: string;
  cacheStatus: CacheStatus;
};

export type MarketPriceResultData = {
  prices: MarketPrice[];
  failures: PriceFetchFailure[];
};

export type LogLevels = "info" | "warn" | "error";

export type RetryContext = {
  operationId?: string;
  provider?: string;
  symbol?: string;
  exchange?: Exchange;
  mode?: MarketDataMode;
  [key: string]: unknown;
}

export type RetryConfig = {
  attempts: number;
  timeoutMs: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  jitterMs?: number;
}
