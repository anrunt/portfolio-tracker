import { Redis } from "@upstash/redis";
import { z } from "zod";
import {
  CacheConfig,
  CacheContext,
  Exchange,
  MarketDataProvider,
  MarketPrice,
} from "./types";
import { logMarketData } from "./logger";

const FRESH_CACHE_TTL_MS = 60_000;
const STALE_CACHE_TTL_SECONDS = 300;
const STALE_CACHE_MAX_AGE_MS = 300_000;


const CachedMarketPriceSchema = z.object({
  symbol: z.string(),
  price: z.number().positive(),
  currency: z.enum(["USD", "PLN"]),
  provider: z.enum(["finnhub", "yahoo"]),
  fetchedAt: z.iso.datetime(),
});

type CachedMarketPrice = z.infer<typeof CachedMarketPriceSchema>;

type CacheReadResult =
  | {
    kind: "found";
    freshness: "fresh" | "stale";
    data: CachedMarketPrice;
  }
  | {
    kind: "miss";
    reason: "not-found" | "expired" | "invalid" | "read-error";
  };

export function createRedisPriceCache(config: CacheConfig) {
  const redis = new Redis({
    url: config.url,
    token: config.token,
  });

  function buildCacheKey(
    provider: MarketDataProvider,
    exchange: Exchange,
    symbol: string,
  ) {
    return `market-price:v1:${provider}:${exchange}:${symbol}`;
  }

  async function getCachedMarketPrice(
    context: CacheContext,
  ): Promise<CacheReadResult> {
    const key = buildCacheKey(
      context.provider,
      context.exchange,
      context.symbol,
    );

    let cachedData: unknown;

    try {
      cachedData = await redis.get(key);
    } catch (error) {
      logMarketData("error", {
        event: "market_price_cache_read_failed",
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });

      return {
        kind: "miss",
        reason: "read-error",
      };
    }

    if (cachedData === null) {
      return {
        kind: "miss",
        reason: "not-found",
      };
    }

    const parsedData = CachedMarketPriceSchema.safeParse(cachedData);

    if (!parsedData.success) {
      logMarketData("warn", {
        event: "market_price_cache_invalid",
        ...context,
        validationErrors: parsedData.error.issues,
      });

      await deleteCachedMarketPrice(key, context);

      return {
        kind: "miss",
        reason: "invalid",
      };
    }

    const ageMs = Date.now() - Date.parse(parsedData.data.fetchedAt);

    if (ageMs > STALE_CACHE_MAX_AGE_MS) {
      return {
        kind: "miss",
        reason: "expired",
      };
    }

    return {
      kind: "found",
      freshness: ageMs <= FRESH_CACHE_TTL_MS ? "fresh" : "stale",
      data: parsedData.data,
    };
  }

  async function setCachedMarketPrice(
    price: MarketPrice,
    context: CacheContext,
  ): Promise<boolean> {
    const key = buildCacheKey(
      context.provider,
      context.exchange,
      context.symbol,
    );
    const cachePayload: CachedMarketPrice = {
      symbol: price.symbol,
      price: price.price,
      currency: price.currency,
      provider: price.provider,
      fetchedAt: price.fetchedAt,
    };

    try {
      await redis.set(key, cachePayload, { ex: STALE_CACHE_TTL_SECONDS });
      return true;
    } catch (error) {
      logMarketData("error", {
        event: "market_price_cache_write_failed",
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });

      return false;
    }
  }

  async function deleteCachedMarketPrice(
    key: string,
    context: CacheContext,
  ): Promise<void> {
    try {
      await redis.del(key);
    } catch (error) {
      logMarketData("error", {
        event: "market_price_cache_delete_failed",
        ...context,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    getCachedMarketPrice,
    setCachedMarketPrice,
    deleteCachedMarketPrice,
  };
}
