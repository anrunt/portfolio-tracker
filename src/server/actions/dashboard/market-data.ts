"use server";

import { Result, type SerializedResult } from "better-result";

import { getSession } from "../../better-auth/session";
import {
  ApiError,
  ConfigError,
  UnauthenticatedError,
  ValidationError,
  type PriceError,
  type SearchTickerError,
} from "../../errors";
import type {
  FinnhubQuote,
  FinnhubStock,
  PriceFetchFailure,
  PriceResultData,
  PriceSuccess,
  SerializedError,
} from "../types";

export async function searchTicker(
  query: string,
  exchange: string = "US"
): Promise<SerializedResult<FinnhubStock[], SerializedError>> {
  const result = await searchTickerResult(query, exchange);
  return Result.serialize(result.mapError((e) => e.toJSON() as SerializedError));
}

async function searchTickerResult(
  query: string,
  exchange: string = "US"
): Promise<Result<FinnhubStock[], SearchTickerError>> {
  return Result.gen(async function* () {
    const session = await getSession();
    if (!session) {
      return Result.err(new UnauthenticatedError());
    }

    const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;

    if (!FINNHUB_API_KEY) {
      return Result.err(new ConfigError({ key: "FINNHUB_API_KEY" }));
    }

    if (exchange !== "US" && exchange !== "WA") {
      return Result.err(
        new ValidationError({
          field: "exchange",
          message: "Unsupported exchange. Must be 'US' or 'WA'.",
        })
      );
    }

    const fetchResult = yield* Result.await(
      Result.tryPromise({
        try: async () => {
          const response = await fetch(
            `https://finnhub.io/api/v1/search?q=${query}&token=${FINNHUB_API_KEY}&exchange=${exchange}`
          );

          if (!response.ok) {
            throw new ApiError({
              service: "Finnhub",
              status: response.status,
            });
          }

          const data = await response.json();
          return data.result as FinnhubStock[];
        },
        catch: (e) =>
          e instanceof ApiError
            ? e
            : new ApiError({ service: "Finnhub", cause: e }),
      })
    );

    console.log("Finnhub data: ", fetchResult);
    return Result.ok(fetchResult);
  });
}

export async function getPrice(companySymbols: string[], exchange: string): Promise<SerializedResult<PriceResultData, SerializedError>> {
  const result = await getPriceResult(companySymbols, exchange);
  return Result.serialize(result.mapError((e) => e.toJSON() as SerializedError));
}

async function getPriceResult(companySymbols: string[], exchange: string): Promise<Result<PriceResultData, PriceError>> {
  return Result.gen(async function* () {
    const session = await getSession();
    if (!session) {
      return Result.err(new UnauthenticatedError());
    }

    const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY;
    if (!FINNHUB_API_KEY) {
      return Result.err(new ConfigError({ key: "FINNHUB_API_KEY" }));
    }

    if (exchange !== "US" && exchange !== "WA") {
      return Result.err(
        new ValidationError({
          field: "exchange",
          message: "Unsupported exchange. Must be 'US' or 'WA'.",
        })
      );
    }

    const fetchPrices = yield* Result.await(
      Result.tryPromise({
        try: async () => {
          if (exchange === "US") {
            const promises = companySymbols.map(async (symbol) => {
              const response = await fetch(
                `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${FINNHUB_API_KEY}`,
                { cache: "no-store" }
              );

              if (!response.ok) {
                throw new Error(`${symbol}: HTTP ${response.status}`)
              }

              const data = (await response.json()) as FinnhubQuote;

              return {
                symbol: symbol,
                price: data.c
              }
            })
            const settledPromises = await Promise.allSettled(promises);

            const prices: PriceSuccess[] = [];
            const failures: PriceFetchFailure[] = [];

            for (let i = 0; i < settledPromises.length; i++) {
              const res = settledPromises[i];
              if (res.status === "fulfilled") {
                prices.push(res.value);
              } else {
                failures.push({
                  symbol: companySymbols[i],
                  reason: res.reason instanceof Error
                    ? res.reason.message
                    : String(res.reason)
                })
              }
            }

            return { prices, failures } satisfies PriceResultData;
          } else {
            const stoqSymbols = companySymbols.map((s) => s.replace(".WA", ""));

            const response = await fetch(
              `https://stooq.pl/q/l/?s=${stoqSymbols.join("+")}&f=sc&e=csv`,
              { cache: "no-store" }
            );

            if (!response.ok) {
              throw new Error(`Stoq HTTP: ${response.status}`);
            }

            const text = await response.text();

            const lines = text.trim().split("\n");

            const prices: PriceSuccess[] = [];
            const failures: PriceFetchFailure[] = [];

            for (const line of lines) {
              const [stoqSymbol, priceStr] = line.split(",");
              const originalSymbol = `${stoqSymbol}.WA`

              if (priceStr === "B/D" || isNaN(Number(priceStr))) {
                failures.push({symbol: originalSymbol, reason: "No data avaiable"})
              } else {
                prices.push({symbol: originalSymbol, price: Number(priceStr)})
              }
            }

            return { prices, failures } satisfies PriceResultData;
          }
        },
        catch: (e) =>
          e instanceof ApiError
            ? e
            : new ApiError({ service: "Finnhub / Stoq", cause: e })
      })
    )

    return Result.ok(fetchPrices);
  })
}
