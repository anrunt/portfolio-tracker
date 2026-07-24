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
  FinnhubStock,
  PriceResultData,
  SerializedError,
} from "../types";
import { getPrices } from "@/server/services/market-data/get-prices";
import { toPriceResultData } from "@/server/services/market-data/mappers";
import type { GetPricesInput } from "@/server/services/market-data/types";

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

    if (exchange !== "US" && exchange !== "WA") {
      return Result.err(
        new ValidationError({
          field: "exchange",
          message: "Unsupported exchange. Must be 'US' or 'WA'.",
        })
      );
    }

    const input: GetPricesInput = {
      symbols: companySymbols,
      exchange: exchange,
      mode: "user-refresh",
      operationId: crypto.randomUUID()
    }

    const prices = yield* Result.await(
      getPrices(input)
    );

    return Result.ok(toPriceResultData(prices));
  })
}
