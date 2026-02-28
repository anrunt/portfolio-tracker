"use server";

import { getSession } from "../better-auth/session";
import { lt, z } from "zod";
import { db } from "../db";
import { position, wallet } from "../db/schema";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { QUERIES } from "../db/queries";
import { and, eq } from "drizzle-orm";
import { Result, SerializedResult } from "better-result";
import {
  UnauthenticatedError,
  UnauthorizedError,
  NotFoundError,
  ValidationError,
  ConfigError,
  ApiError,
  DatabaseError,
  type SearchTickerError,
  type WalletError,
  type PositionError,
  PriceError,
  WalletChartError,
} from "../errors";
import type { FinnhubStock, FinnhubQuote, SerializedError, FieldErrors, PriceSuccess, PriceFetchFailure, PriceResultData, TimeRange, ChartDataPoint } from "./types";

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
                { next: { revalidate: 60 } } // 60 for now, with tanstack query it might show outdated price but its fine - for now i want to protect my rate limits
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
              { next: { revalidate: 60 } }
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
            : new ApiError({ service: "Finnhub", cause: e })
      })
    )

    return Result.ok(fetchPrices);
  })
}

const walletSchema = z.object({
  name: z.coerce
    .string()
    .max(50, { message: "Wallet name can't be longer than 50 characters!" }),
  currency: z.enum(["USD", "PLN"], {
    message: "Please select a valid currency (USD or PLN)",
  }),
});

export async function addWallet(
  prevState: { message: string; success: boolean; timestamp: number },
  formData: FormData
): Promise<{ message: string; success: boolean; timestamp: number }> {
  const result = await addWalletResult(formData);

  return result.match({
    ok: () => ({ message: "", success: true as boolean, timestamp: Date.now() }),
    err: (e) => ({ message: e.message, success: false as boolean, timestamp: Date.now() }),
  });
}

async function addWalletResult(
  formData: FormData
): Promise<Result<void, WalletError>> {
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    const name = formData.get("name");
    const currency = formData.get("currency");

    const parsed = walletSchema.safeParse({ name, currency });

    if (!parsed.success) {
      return Result.err(
        new ValidationError({
          message: parsed.error.issues[0].message,
        })
      );
    }

    console.log("Adding wallet:", { name, currency });

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db.insert(wallet).values({
            id: randomUUID(),
            name: parsed.data.name,
            userId: user.session.userId,
            currency: parsed.data.currency,
          });
        },
        catch: (e) => new DatabaseError({ operation: "insert wallet", cause: e }),
      })
    );

    revalidatePath("/dashboard");

    return Result.ok(undefined);
  });
}

const renameWalletSchema = z.coerce
  .string()
  .max(50, { message: "Wallet name can't be longer than 50 characters!" });

export async function renameWallet(
  walletId: string,
  prevState: { message: string; success: boolean; timestamp: number },
  formData: FormData
): Promise<{ message: string; success: boolean; timestamp: number }> {
  const result = await renameWalletResult(formData, walletId);

  return result.match({
    ok: () => ({ message: "", success: true as boolean, timestamp: Date.now() }),
    err: (e) => ({ message: e.message, success: false as boolean, timestamp: Date.now() }),
  });
}

async function renameWalletResult(formData: FormData, walletId: string): Promise<Result<void, WalletError>>{
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    const userWallet = await QUERIES.getWalletById(walletId, user.session.userId);
    if (!userWallet) {
      return Result.err(new NotFoundError({ resource: "Wallet", id: walletId }));
    }

    const name = formData.get("name");

    const parsedName = renameWalletSchema.safeParse(name);

    if (!parsedName.success) {
      return Result.err(
        new ValidationError({
          message: parsedName.error.issues[0].message,
        })
      );
    }

    if (name === userWallet.name) {
      return Result.err(
        new ValidationError({
          message: "New name must be different from the current name.",
        })
      );
    }

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db
            .update(wallet)
            .set({name: parsedName.data})
            .where(and(eq(wallet.id, walletId), eq(wallet.userId, user.session.userId)))
        },
        catch: (e) => new DatabaseError({ operation: "insert wallet", cause: e }),
      })
    )

    revalidatePath("/dashboard");

    return Result.ok(undefined);
  })
}

const positionSchema = z.object({
  companyName: z.string(),
  companySymbol: z.string(),
  position: z.array(z.object({
    shares: z.coerce.number().nonnegative({ message: "Invalid share number, must be nonnegative" }),
    price: z.coerce.number().nonnegative({ message: "Invalid price number, must be nonnegative" }),
  }))
});

export async function addPosition(
  companyName: string,
  companySymbol: string,
  walletId: string,
  prevState: { message: string; success: boolean; timestamp: number, fieldErrors: FieldErrors | undefined },
  formData: FormData
): Promise<{ message: string; success: boolean; timestamp: number; fieldErrors: FieldErrors | undefined }> {
  const result = await addPositionResult(
    companyName,
    companySymbol,
    walletId,
    formData
  );

  return result.match({
    ok: () => ({ message: "", success: true as boolean, timestamp: Date.now(), fieldErrors: undefined }),
    err: (e) => ({ message: e.message, success: false as boolean, timestamp: Date.now(), fieldErrors: "fieldErrors" in e ? e.fieldErrors : undefined }),
  });
}

async function addPositionResult(
  companyName: string,
  companySymbol: string,
  walletId: string,
  formData: FormData
): Promise<Result<void, PositionError>> {
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    const userWallet = await QUERIES.getWalletById(walletId, user.session.userId);
    if (!userWallet) {
      return Result.err(new NotFoundError({ resource: "Wallet", id: walletId }));
    }

    const shares = formData.getAll("shares");
    const price = formData.getAll("price");

    const positions = shares.map((share, index) => ({ shares: share, price: price[index] }));

    //    console.log("Positions: ", positions);

    const validatedFields = positionSchema.safeParse({
      companyName: companyName,
      companySymbol: companySymbol,
      position: positions
    });

    if (!validatedFields.success) {
      //      console.log("Err with validating position: ", validatedFields.error.issues);

      const fieldErrors = validatedFields.error.issues.reduce<FieldErrors>((acc, err) => {
        const index = err.path[1] as number;
        const field = err.path[2] as "shares" | "price";

        if (!acc[index]) {
          acc[index] = {};
        }

        acc[index][field] = err.message;

        return acc;
      }, {});

      return Result.err(
        new ValidationError({
          message: "Invalid position data",
          fieldErrors: fieldErrors
        })
      );
    }

    const insertData = validatedFields.data.position.map((data) => {
      return {
        id: randomUUID(),
        walletId: walletId,
        companyName: companyName,
        companySymbol: companySymbol,
        pricePerShare: data.price,
        quantity: data.shares
      }
    })

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db.insert(position).values(insertData);
        },
        catch: (e) =>
          new DatabaseError({ operation: "insert position", cause: e }),
      })
    );

    revalidatePath(`/dashboard/${walletId}`);

    return Result.ok(undefined);
  });
}

export async function deleteWallet(walletId: string): Promise<void> {
  const result = await deleteWalletResult(walletId);
  if (result.status === "error") {
    throw new Error(result.error.message);
  }
}

export async function deleteWalletResult(
  walletId: string
): Promise<Result<void, WalletError>> {
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db
            .delete(wallet)
            .where(
              and(
                eq(wallet.id, walletId),
                eq(wallet.userId, user.session.userId)
              )
            );
        },
        catch: (e) =>
          new DatabaseError({ operation: "delete wallet", cause: e }),
      })
    );

    revalidatePath("/dashboard");

    return Result.ok(undefined);
  });
}

export async function deletePosition(
  positionId: string,
  walletId: string
): Promise<void> {
  const result = await deletePositionResult(positionId, walletId);
  if (result.status === "error") {
    throw new Error(result.error.message);
  }
}

export async function deletePositionResult(
  positionId: string,
  walletId: string
): Promise<Result<void, PositionError>> {
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    const userWallet = await QUERIES.getWalletById(walletId, user.session.userId);

    if (!userWallet) {
      return Result.err(
        new UnauthorizedError({ resource: `wallet ${walletId}` })
      );
    }

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db
            .delete(position)
            .where(
              and(eq(position.id, positionId), eq(position.walletId, walletId))
            );
        },
        catch: (e) =>
          new DatabaseError({ operation: "delete position", cause: e }),
      })
    );

    revalidatePath(`/dashboard/${walletId}`);

    return Result.ok(undefined);
  });
}

export async function getWalletChartData(walletId: string, range: TimeRange): Promise<SerializedResult<ChartDataPoint[], SerializedError>> {
  const result = await getWalletChartDataResult(walletId, range);
  return Result.serialize(result.mapError((e) => e.toJSON() as SerializedError));
}

async function getWalletChartDataResult(walletId: string, range: TimeRange): Promise<Result<ChartDataPoint[], WalletChartError>> {
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    if (range === "1D") {
      const start = new Date();
      start.setUTCHours(0,0,0,0);

      const intradayDataRaw = await QUERIES.getIntradayPortfolioData(walletId, start);
      if (!intradayDataRaw) {
        return Result.err(new NotFoundError({resource: "Wallet Snapshots", id: walletId}));
      }

      const intradayData = intradayDataRaw.map((r) => ({
        timestamp: r.snapshotAt.getTime(),
        totalValue: r.totalValue,
        totalCostBasis: r.totalCostBasis
      }));

      console.log("Intraday data: ", intradayData);

      return Result.ok(intradayData);
    } else if (["1W", "1M", "3M", "6M", "1YR"].includes(range)) {
      const start = new Date();

      switch (range) {
        case "1W":
          start.setDate(start.getDate() - 7);
          break;
        case "1M":
          start.setMonth(start.getMonth() - 1);
          break;
        case "3M":
          start.setMonth(start.getMonth() - 3);
          break;
        case "6M":
          start.setMonth(start.getMonth() - 6);
          break;
        case "1YR":
          start.setFullYear(start.getFullYear() - 1);
          break;
      }

      const startDateStr = start.toISOString().split("T")[0];
      const dailyDataRaw = await QUERIES.getDailyPortfolioData(walletId, startDateStr);
      if (!dailyDataRaw) {
        return Result.err(new NotFoundError({resource: "Wallet Snapshots", id: walletId}));
      }
      
      const dailyData = dailyDataRaw.map((r) => ({
        timestamp: new Date(r.snapshotDate).getTime(),
        label: r.snapshotDate,
        totalValue: r.totalValue,
        totalCostBasis: r.totalCostBasis
      }))

      // For now, just return a ValidationError, placeholder for future implementation
      return Result.ok(dailyData);
    } else {
      return Result.err(new ValidationError({ field: "range", message: "Unsupported time range for chart data" }));
    }
  })
}
