import { ConfigError, MarketDataError } from "@/server/errors";
import { CacheConfig, CacheContext, GetPricesInput, MarketPrice, MarketPriceResultData } from "./types";
import { Result } from "better-result";
import { getFinnhubConfig, getRedisConfig } from "./config";
import { createRedisPriceCache } from "./cache";

export async function getPrices(
  input: GetPricesInput,
): Promise<Result<MarketPriceResultData, MarketDataError>> {
  return Result.gen(async function* () {
    const startedAt = performance.now();

    if (input.symbols.length === 0) {
      return Result.ok({ prices: [], failures: [] });
    }

    switch (input.exchange) {
      case "US":
        const finnhubConfig = yield* getFinnhubConfig();

        if (input.mode === "user-refresh") {
          const redisConfig = yield* getRedisConfig();

          const redis = createRedisPriceCache(redisConfig);

          const promises = input.symbols.map(async (symbol) => {
            const cacheContext: CacheContext = {
              operationId: input.operationId,
              mode: input.mode,
              provider: "finnhub",
              symbol: symbol,
              exchange: input.exchange
            }

            const cacheResult = await redis.getCachedMarketPrice(cacheContext);
            if (cacheResult.kind === "found" && cacheResult.freshness === "fresh") {
              return {
                symbol: symbol,
                price: cacheResult.data.price,
                currency: "USD",
                provider: "finnhub",
                cacheStatus: "hit",
                fetchedAt: cacheResult.data.fetchedAt
              } satisfies MarketPrice
            }

            if (cacheResult.kind === "found" && cacheResult.freshness === "stale") {
              const staleCacheData = cacheResult.data;


            }
          })


        }

        break;

      case "WA":
        // Yahoo
        break;

      default:
        input.exchange satisfies never;
    }
  });
}
