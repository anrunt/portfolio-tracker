import { MarketDataError } from "@/server/errors";
import { CacheContext, GetPricesInput, MarketPrice, MarketPriceResultData } from "./types";
import { Result } from "better-result";
import { getFinnhubConfig, getRedisConfig } from "./config";
import { createRedisPriceCache } from "./cache";
import { fetchFinnhubUsPrices } from "./providers";
import { logMarketData } from "./logger";
import { PriceFetchFailure } from "@/server/actions/types";

export async function getPrices(
  input: GetPricesInput,
): Promise<Result<MarketPriceResultData, MarketDataError>> {
  return Result.gen(async function* () {
    const startedAt = performance.now();

    if (input.symbols.length === 0) {
      const data: MarketPriceResultData = { prices: [], failures: [] };
      logBatchCompleted(input, data, startedAt);
      return Result.ok(data);
    }

    switch (input.exchange) {
      case "US":
        const finnhubConfig = yield* getFinnhubConfig();

        if (input.mode === "user-refresh") { // user-refresh
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

            const staleCacheData = cacheResult.kind === "found" && cacheResult.freshness === "stale"
              ? cacheResult.data
              : undefined

            try {
              const providerPrice = await fetchFinnhubUsPrices(symbol, { mode: input.mode, operationId: input.operationId }, finnhubConfig.apiKey);

              const marketPrice: MarketPrice = {
                ...providerPrice,
                cacheStatus: "miss"
              }
              await redis.setCachedMarketPrice(marketPrice, cacheContext);

              return marketPrice;
            } catch (e) {
              if (staleCacheData) {
                const marketPrice: MarketPrice = {
                  ...staleCacheData,
                  cacheStatus: "stale-if-error"
                }

                logMarketData("warn", {
                  event: "market_price_stale_if_error_used",
                  ...cacheContext,
                  error: e instanceof Error ? e.message : String(e),
                });

                return marketPrice;
              }

              throw e;
            }
          })

          // handle promises
          const settledPromises = await Promise.allSettled(promises);

          const prices: MarketPrice[] = [];
          const failures: PriceFetchFailure[] = [];

          for (const [index, res] of settledPromises.entries()) {
            if (res.status === "fulfilled") {
              prices.push(res.value);
            } else {
              failures.push({
                symbol: input.symbols[index],
                reason:
                  res.reason instanceof Error
                    ? res.reason.message
                    : String(res.reason),
              });
            }
          }

          const data = { prices, failures } satisfies MarketPriceResultData;
          logBatchCompleted(input, data, startedAt);
          return Result.ok(data);
        } else { // snapshot
          const promises = input.symbols.map(async (symbol) => {
            const providerPrice = await fetchFinnhubUsPrices(
              symbol,
              {
                mode: input.mode,
                operationId: input.operationId,
              },
              finnhubConfig.apiKey,
            );

            return {
              ...providerPrice,
              cacheStatus: "bypass",
            } satisfies MarketPrice;
          });

          const settledPromises = await Promise.allSettled(promises);
          const prices: MarketPrice[] = [];
          const failures: PriceFetchFailure[] = [];

          for (const [index, res] of settledPromises.entries()) {
            if (res.status === "fulfilled") {
              prices.push(res.value);
            } else {
              failures.push({
                symbol: input.symbols[index]!,
                reason:
                  res.reason instanceof Error
                    ? res.reason.message
                    : String(res.reason),
              });
            }
          }

          const data = { prices, failures } satisfies MarketPriceResultData;
          logBatchCompleted(input, data, startedAt);
          return Result.ok(data);
        }

      case "WA":
        // Yahoo
        break;

      default:
        input.exchange satisfies never;
    }
  });
}

function logBatchCompleted(
  input: GetPricesInput,
  data: MarketPriceResultData,
  startedAt: number,
): void {
  const cacheHits = data.prices.filter(
    (price) => price.cacheStatus === "hit",
  ).length;
  const cacheMisses = data.prices.filter(
    (price) => price.cacheStatus === "miss",
  ).length;
  const staleIfErrorCount = data.prices.filter(
    (price) => price.cacheStatus === "stale-if-error",
  ).length;
  const providerCalls =
    data.prices.filter((price) => price.cacheStatus !== "hit").length +
    data.failures.length;

  logMarketData("info", {
    event: "market_price_batch_completed",
    operationId: input.operationId,
    mode: input.mode,
    exchange: input.exchange,
    symbolCount: input.symbols.length,
    successCount: data.prices.length,
    failureCount: data.failures.length,
    cacheHits,
    cacheMisses,
    staleIfErrorCount,
    providerCalls,
    durationMs: Math.round(performance.now() - startedAt),
  });
}
