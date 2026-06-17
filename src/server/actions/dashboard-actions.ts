"use server";

import { getSession } from "../better-auth/session";
import { z } from "zod";
import { db } from "../db";
import { numToNumericString } from "../db/numeric";
import { portfolioTransaction, position, user, wallet } from "../db/schema";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { QUERIES } from "../db/queries";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
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
import type { FinnhubStock, FinnhubQuote, SerializedError, FieldErrors, PriceSuccess, PriceFetchFailure, PriceResultData, TimeRange, ChartDataPoint, DisplayCurrency } from "./types";

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

const walletSchema = z.object({
  name: z
    .string({ error: "Wallet name is required" })
    .trim()
    .min(2, { error: "Wallet name must be at least 2 characters" })
    .max(50, { error: "Wallet name can't be longer than 50 characters!" }),
  currency: z.enum(["USD", "PLN"], {
    error: "Please select a valid currency (USD or PLN)",
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
      const errors = z.flattenError(parsed.error);

      return Result.err(
        new ValidationError({
          message: "Invalid wallet data",
          fieldErrors: {
            name: errors.fieldErrors.name?.[0],
            currency: errors.fieldErrors.currency?.[0],
          },
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

const renameWalletSchema = z.object({
  name: z
    .string({ error: "Wallet name is required" })
    .trim()
    .min(2, { error: "Wallet name must be at least 2 characters" })
    .max(50, { error: "Wallet name can't be longer than 50 characters!" }),
});

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

    const parsedName = renameWalletSchema.safeParse({ name });

    if (!parsedName.success) {
      const errors = z.flattenError(parsedName.error);

      return Result.err(
        new ValidationError({
          message: "Invalid wallet name",
          fieldErrors: {
            name: errors.fieldErrors.name?.[0],
          },
        })
      );
    }

    if (parsedName.data.name === userWallet.name) {
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
            .set({name: parsedName.data.name})
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
    shares: z.coerce.number().nonnegative({ error: "Invalid share number, must be nonnegative" }),
    price: z.coerce.number().nonnegative({ error: "Invalid price number, must be nonnegative" }),
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
      const tree = z.treeifyError(validatedFields.error);
      const fieldErrors: FieldErrors = {};

      tree.properties?.position?.items?.forEach((item, index) => {
        const sharesError = item?.properties?.shares?.errors[0];
        const priceError = item?.properties?.price?.errors[0];

        if (sharesError || priceError) {
          fieldErrors[index] = {};

          if (sharesError) {
            fieldErrors[index].shares = sharesError;
          }

          if (priceError) {
            fieldErrors[index].price = priceError;
          }
        }
      });

      return Result.err(
        new ValidationError({
          message: "Invalid position data",
          fieldErrors: fieldErrors
        })
      );
    }

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db.transaction(async (tx) => {
            const freshWallet = await tx
              .select({
                cashBalance: sql<number>`(${wallet.cashBalance})::double precision`,
              })
              .from(wallet)
              .where(
                and(
                  eq(wallet.id, walletId),
                  eq(wallet.userId, user.session.userId),
                  isNull(wallet.deletedAt)
                )
              )
              .limit(1)
              .for("update")
              .then((rows) => rows[0]);

            if (!freshWallet) {
              throw new NotFoundError({ resource: "Wallet", id: walletId });
            }

            let runningCash = freshWallet.cashBalance;
            let totalBuyCost = 0;
            let totalExternalContribution = 0;

            const positionRows = [];
            const transactionRows = [];

            for (const data of validatedFields.data.position) {
              const positionId = randomUUID();
              const buyCost = data.price * data.shares;
              const cashUsed = Math.min(runningCash, buyCost);
              const externalContribution = buyCost - cashUsed;

              runningCash -= cashUsed;
              totalBuyCost += buyCost;
              totalExternalContribution += externalContribution;

              const quantity = numToNumericString(data.shares);
              const pricePerShare = numToNumericString(data.price);

              positionRows.push({
                id: positionId,
                walletId,
                companyName,
                companySymbol,
                pricePerShare,
                quantity,
                initialQuantity: quantity,
              });

              transactionRows.push({
                id: randomUUID(),
                walletId,
                positionId,
                type: "BUY" as const,
                companyName,
                companySymbol,
                quantity,
                pricePerShare,
                transactionValue: numToNumericString(buyCost),
                cashUsed: numToNumericString(cashUsed),
                externalContribution: numToNumericString(externalContribution),
                realizedPl: "0",
              });
            }

            await tx.insert(position).values(positionRows);
            await tx.insert(portfolioTransaction).values(transactionRows);

            await tx
              .update(wallet)
              .set({
                cashBalance: numToNumericString(runningCash),
                totalBuyCost: sql`${wallet.totalBuyCost} + ${numToNumericString(totalBuyCost)}`,
                totalContributed: sql`${wallet.totalContributed} + ${numToNumericString(totalExternalContribution)}`,
              })
              .where(
                and(
                  eq(wallet.id, walletId),
                  eq(wallet.userId, user.session.userId),
                  isNull(wallet.deletedAt)
                )
              );
          })
        },
        catch: (e) =>
          e instanceof NotFoundError
            ? e
            : new DatabaseError({ operation: "insert position", cause: e }),
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
            .update(wallet)
            .set({
              deletedAt: new Date()
            })
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
          await db.transaction(async (tx) => {
            const positionToDelete = await tx
              .select({
                id: position.id,
                quantity: sql<number>`(${position.quantity})::double precision`,
                closedAt: position.closedAt,
              })
              .from(position)
              .innerJoin(wallet, eq(position.walletId, wallet.id))
              .where(
                and(
                  eq(position.id, positionId),
                  eq(position.walletId, walletId),
                  eq(wallet.userId, user.session.userId),
                  isNull(wallet.deletedAt)
                )
              )
              .limit(1)
              .for("update")
              .then((rows) => rows[0]);

            if (!positionToDelete) {
              throw new NotFoundError({ resource: "Position", id: positionId });
            }

            if (positionToDelete.closedAt !== null || positionToDelete.quantity <= 0) {
              throw new ValidationError({ message: "Cannot delete a closed position" });
            }

            const isPositionSold = await tx
              .select({ id: portfolioTransaction.id })
              .from(portfolioTransaction)
              .where(
                and(
                  eq(portfolioTransaction.walletId, walletId),
                  eq(portfolioTransaction.positionId, positionId),
                  eq(portfolioTransaction.type, "SELL")
                )
              );

            if (isPositionSold.length > 0) {
              throw new ValidationError({ message: "Cannot delete a position that has been sold" });
            }

            const buyTransaction = await tx
              .select({
                id: portfolioTransaction.id,
                cashUsed: portfolioTransaction.cashUsed,
                transactionValue: portfolioTransaction.transactionValue,
                externalContribution: portfolioTransaction.externalContribution,
              })
              .from(portfolioTransaction)
              .where(
                and(
                  eq(portfolioTransaction.walletId, walletId),
                  eq(portfolioTransaction.positionId, positionId),
                  eq(portfolioTransaction.type, "BUY")
                )
              )
              .limit(1)
              .then((rows) => rows[0]);

            if (!buyTransaction) {
              throw new NotFoundError({ resource: "No buy transaction for position", id: positionId });
            }

            const updatedWallet = await tx
              .update(wallet)
              .set({
                cashBalance: sql`${wallet.cashBalance} + ${buyTransaction.cashUsed}`,
                totalBuyCost: sql`${wallet.totalBuyCost} - ${buyTransaction.transactionValue}`,
                totalContributed: sql`${wallet.totalContributed} - ${buyTransaction.externalContribution}`,
              })
              .where(
                and(
                  eq(wallet.id, walletId),
                  eq(wallet.userId, user.session.userId),
                  isNull(wallet.deletedAt)
                )
              )
              .returning({ id: wallet.id });

            if (updatedWallet.length === 0) {
              throw new NotFoundError({ resource: "Wallet", id: walletId });
            }

            await tx.delete(portfolioTransaction).where(eq(portfolioTransaction.id, buyTransaction.id));

            await tx.delete(position).where(eq(position.id, positionToDelete.id));
          });
        },
        catch: (e) =>
          e instanceof NotFoundError || e instanceof ValidationError
            ? e
            : new DatabaseError({ operation: "delete position", cause: e }),
      })
    );

    revalidatePath(`/dashboard/${walletId}`);

    return Result.ok(undefined);
  });
}

type SellPositionState = {
  message: string;
  success: boolean;
  timestamp: number;
  fieldErrors?: {
    quantity?: string;
    price?: string;
    withdrawAmount?: string;
  };
};

const sellPositionSchema = z.object({
  quantity: z
    .string({ error: "Quantity is required" })
    .trim()
    .min(1, { error: "Quantity is required" })
    .transform(Number)
    .pipe(
      z
        .number({ error: "Quantity must be a valid number" })
        .positive({ error: "Quantity must be greater than 0" })
    ),
  price: z
    .string({ error: "Sell price is required" })
    .trim()
    .min(1, { error: "Sell price is required" })
    .transform(Number)
    .pipe(
      z
        .number({ error: "Sell price must be a valid number" })
        .positive({ error: "Sell price must be greater than 0" })
    ),
  withdrawAfterSale: z.coerce.boolean(),
  withdrawAmount: z
    .string({ error: "Withdrawal amount is required" })
    .trim()
    .min(1, { error: "Withdrawal amount is required" })
    .transform(Number)
    .pipe(
      z
        .number({ error: "Withdrawal amount must be a valid number" })
        .nonnegative({ error: "Withdrawal amount cannot be negative" })
    ),
});

export async function sellPositionLot(
  positionId: string,
  walletId: string,
  prevState: SellPositionState,
  formData: FormData
): Promise<SellPositionState> {
  const result = await sellPositionLotResult(positionId, walletId, formData);

  return result.match({
    ok: () => ({ message: "", success: true as boolean, timestamp: Date.now() }),
    err: (e) => ({
      message: e.message,
      success: false as boolean,
      timestamp: Date.now(),
      fieldErrors: "fieldErrors" in e ? (e.fieldErrors as SellPositionState["fieldErrors"]) : undefined,
    }),
  });
}

export async function sellPositionLotResult(
  positionId: string,
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

    const quantity = formData.get("quantity");
    const price = formData.get("price");
    const withdrawAfterSale = formData.get("withdrawAfterSale");
    const withdrawAmount = withdrawAfterSale !== null ? formData.get("withdrawAmount") : "0";

    const parsed = sellPositionSchema.safeParse({
      quantity,
      price,
      withdrawAfterSale,
      withdrawAmount,
    });

    if (!parsed.success) {
      const errors = z.flattenError(parsed.error);
      return Result.err(
        new ValidationError({
          message: "Invalid input",
          fieldErrors: {
            quantity: errors.fieldErrors.quantity?.[0],
            price: errors.fieldErrors.price?.[0],
            withdrawAmount: errors.fieldErrors.withdrawAmount?.[0],
          },
        })
      );
    }

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db.transaction(async (tx) => {
            const userPosition = await tx
              .select({
                id: position.id,
                walletId: position.walletId,
                companyName: position.companyName,
                companySymbol: position.companySymbol,
                pricePerShare: sql<number>`(${position.pricePerShare})::double precision`,
                quantity: sql<number>`(${position.quantity})::double precision`,
                closedAt: position.closedAt,
              })
              .from(position)
              .innerJoin(wallet, eq(position.walletId, wallet.id))
              .where(
                and(
                  eq(position.id, positionId),
                  eq(position.walletId, walletId),
                  eq(wallet.userId, user.session.userId),
                  gt(position.quantity, "0"),
                  isNull(position.closedAt),
                  isNull(wallet.deletedAt)
                )
              )
              .limit(1)
              .for("update")
              .then((rows) => rows[0]);

            if (!userPosition) {
              throw new NotFoundError({ resource: "Position", id: positionId });
            }

            if (parsed.data.quantity > userPosition.quantity) {
              throw new ValidationError({
                message: "Sell quantity cannot exceed position quantity",
                fieldErrors: { quantity: "Sell quantity cannot exceed position quantity" },
              });
            }

            const proceeds = parsed.data.quantity * parsed.data.price;
            const costBasisSold = parsed.data.quantity * userPosition.pricePerShare;
            const realizedPl = proceeds - costBasisSold;
            const withdrawal = parsed.data.withdrawAfterSale ? parsed.data.withdrawAmount : 0;

            if (withdrawal > proceeds) {
              throw new ValidationError({
                message: "Withdrawal amount cannot exceed proceeds from sale",
                fieldErrors: { withdrawAmount: "Withdrawal amount cannot exceed proceeds from sale" },
              });
            }

            const newQuantity = userPosition.quantity - parsed.data.quantity;
            const isPositionClosed = newQuantity === 0;

            await tx
              .update(position)
              .set({
                quantity: numToNumericString(newQuantity),
                ...(isPositionClosed ? { closedAt: new Date() } : {}),
              })
              .where(and(eq(position.walletId, walletId), eq(position.id, positionId)));

            await tx.insert(portfolioTransaction).values({
              id: randomUUID(),
              walletId,
              positionId,
              type: "SELL",
              companyName: userPosition.companyName,
              companySymbol: userPosition.companySymbol,
              quantity: numToNumericString(parsed.data.quantity),
              pricePerShare: numToNumericString(parsed.data.price),
              transactionValue: numToNumericString(proceeds),
              cashUsed: "0",
              externalContribution: "0",
              realizedPl: numToNumericString(realizedPl),
            });

            if (withdrawal > 0) {
              await tx.insert(portfolioTransaction).values({
                id: randomUUID(),
                walletId,
                positionId: null,
                type: "WITHDRAWAL",
                companyName: null,
                companySymbol: null,
                quantity: null,
                pricePerShare: null,
                transactionValue: numToNumericString(withdrawal),
                cashUsed: "0",
                externalContribution: "0",
                realizedPl: "0",
              });
            }

            await tx
              .update(wallet)
              .set({
                cashBalance: sql`${wallet.cashBalance} + ${numToNumericString(proceeds - withdrawal)}`,
                realizedPl: sql`${wallet.realizedPl} + ${numToNumericString(realizedPl)}`,
                totalWithdrawn: sql`${wallet.totalWithdrawn} + ${numToNumericString(withdrawal)}`,
              })
              .where(
                and(
                  eq(wallet.id, walletId),
                  eq(wallet.userId, user.session.userId),
                  isNull(wallet.deletedAt)
                )
              );
          });
        },
        catch: (e) =>
          e instanceof NotFoundError || e instanceof ValidationError
            ? e
            : new DatabaseError({ operation: "sell position lot", cause: e }),
      })
    );

    revalidatePath(`/dashboard/${walletId}`);

    return Result.ok(undefined);
  });
}

type SellAllState = {
  message: string;
  success: boolean;
  timestamp: number;
  fieldErrors?: {
    price?: string;
    withdrawAmount?: string;
  };
};

const sellAllSchema = z.object({
  price: z
    .string({ error: "Sell price is required" })
    .trim()
    .min(1, { error: "Sell price is required" })
    .transform(Number)
    .pipe(
      z
        .number({ error: "Sell price must be a valid number" })
        .positive({ error: "Sell price must be greater than 0" })
    ),
  withdrawAfterSale: z.coerce.boolean(),
  withdrawAmount: z
    .string({ error: "Withdrawal amount is required" })
    .trim()
    .min(1, { error: "Withdrawal amount is required" })
    .transform(Number)
    .pipe(
      z
        .number({ error: "Withdrawal amount must be a valid number" })
        .nonnegative({ error: "Withdrawal amount cannot be negative" })
    ),
});

export async function sellAllPositionsForSymbol(
  walletId: string,
  companySymbol: string,
  prevState: SellAllState,
  formData: FormData
): Promise<SellAllState> {
  const result = await sellAllPositionsForSymbolResult(walletId, companySymbol, formData);

  return result.match({
    ok: () => ({ message: "", success: true as boolean, timestamp: Date.now() }),
    err: (e) => ({
      message: e.message,
      success: false as boolean,
      timestamp: Date.now(),
      fieldErrors: "fieldErrors" in e ? {
        price: e.fieldErrors?.price,
        withdrawAmount: e.fieldErrors?.withdrawAmount,
      } : undefined,
    }),
  });
}

async function sellAllPositionsForSymbolResult(
  walletId: string,
  companySymbol: string,
  formData: FormData
): Promise<Result<void, PositionError>> {

}


/* No longer needed
export async function deleteAllPositions(walletId: string, companySymbol: string) {
  const result = await deleteAllPositionsResult(walletId, companySymbol);
  if (result.status === "error") {
    throw new Error(result.error.message);
  }
}

export async function deleteAllPositionsResult(walletId: string, companySymbol: string) {
  return Result.gen(async function *() {
    const user = await getSession();

    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    const isUserWallet = await QUERIES.getWalletById(walletId, user.session.userId);
    if (!isUserWallet) {
      return Result.err(new UnauthorizedError({ resource: `wallet ${walletId}` }))
    }

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db
            .delete(position)
            .where(
              and(
                eq(position.walletId, walletId),
                eq(position.companySymbol, companySymbol)
              )
            )
        },
        catch: (e) =>
          new DatabaseError({ operation: "delete position", cause: e }),
      })
    );

    revalidatePath(`/dashboard/${walletId}`);

    return Result.ok(undefined);
  })
}
*/

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

    const isUserWallet = await QUERIES.getWalletById(walletId, user.session.userId);
    if (!isUserWallet) {
      return Result.err(new UnauthorizedError({ resource: `wallet ${walletId}` }))
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
        totalValue: Number(r.totalValue),
        totalCostBasis: Number(r.totalCostBasis),
      }));

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
        totalValue: Number(r.totalValue),
        totalCostBasis: Number(r.totalCostBasis),
      }))

      return Result.ok(dailyData);
    } else {
      return Result.err(new ValidationError({ field: "range", message: "Unsupported time range for chart data" }));
    }
  })
}



export async function setDisplayCurrency(
  currency: DisplayCurrency
): Promise<SerializedResult<void, SerializedError>> {
  const result = await setDisplayCurrencyResult(currency);
  return Result.serialize(result.mapError((e) => e.toJSON() as SerializedError));
}

async function setDisplayCurrencyResult(
  currency: DisplayCurrency
): Promise<Result<void, UnauthenticatedError | ValidationError | DatabaseError>> {
  return Result.gen(async function* () {
    const session = await getSession();
    if (!session) {
      return Result.err(new UnauthenticatedError());
    }

    if (currency !== "USD" && currency !== "PLN") {
      return Result.err(
        new ValidationError({
          field: "currency",
          message: "Display currency must be USD or PLN.",
        })
      );
    }

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db
            .update(user)
            .set({ displayCurrency: currency })
            .where(eq(user.id, session.session.userId));
        },
        catch: (e) =>
          new DatabaseError({ operation: "update displayCurrency", cause: e }),
      })
    );

    revalidatePath("/dashboard");

    return Result.ok(undefined);
  });
}

export async function getAllWalletsPortfolioData(range: TimeRange, displayCurrency: "PLN" | "USD"): Promise<SerializedResult<ChartDataPoint[], SerializedError>> {
  const result = await getAllWalletsPortfolioDataResult(range, displayCurrency);
  return Result.serialize(result.mapError((e) => e.toJSON() as SerializedError));
}

async function getAllWalletsPortfolioDataResult(range: TimeRange, displayCurrency: "PLN" | "USD"): Promise<Result<ChartDataPoint[], WalletChartError>>{
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    if (range === "1D") {
      const start = new Date();
      start.setUTCHours(0,0,0,0);

      const intradayPortfolioDataRaw = await QUERIES.getAllWalletsIntradayPortfolioData(user.session.userId, start);
      if (!intradayPortfolioDataRaw) {
        return Result.err(new NotFoundError({resource: "Wallet Snapshots"}));
      }

      const needsFxRates = intradayPortfolioDataRaw.some(
        (r) => r.walletCurrency !== displayCurrency
      );
      let fxRate: number | null = null;

      if (needsFxRates) {
        const fx = await QUERIES.getFxRateBefore(start);

        if (!fx) {
          return Result.err(new NotFoundError({resource: "Fx rate"}));
        }

        fxRate = fx.rate;
      }

      const byTimestamp = new Map<number, {timestamp: number, totalValue: number, totalCostBasis:number}>();

      for (const r of intradayPortfolioDataRaw) {
        const timestamp = r.snapshotAt.getTime();

        let totalValue = Number(r.totalValue);
        let totalCostBasis = Number(r.totalCostBasis);

        if (r.walletCurrency !== displayCurrency) {
          if (fxRate === null) {
            return Result.err(new NotFoundError({resource: "Fx rate"}));
          }

          if (r.walletCurrency === "USD") {
            totalValue = totalValue * fxRate;
            totalCostBasis = totalCostBasis * fxRate;
          } else {
            totalValue = totalValue / fxRate;
            totalCostBasis = totalCostBasis / fxRate;
          }
        }

        const existingPoint = byTimestamp.get(timestamp);

        if (existingPoint) {
          existingPoint.totalValue += totalValue;
          existingPoint.totalCostBasis += totalCostBasis;
        } else {
          byTimestamp.set(timestamp, {
            timestamp,
            totalValue,
            totalCostBasis,
          });
        }
      }

      const intradayData = Array.from(byTimestamp.values()).sort(
        (a, b) => a.timestamp - b.timestamp
      );

      return Result.ok(intradayData);
    } else if (["1W", "1M", "3M", "6M", "1YR"].includes(range)) {
      const startDate = new Date();
      const currentDate = new Date();

      switch (range) {
        case "1W":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "1M":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "3M":
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case "6M":
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case "1YR":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const startDateStr = startDate.toISOString().split("T")[0];
      const dailyPortfolioDataRaw = await QUERIES.getAllWalletsDailyPortfolioData(user.session.userId, startDateStr);
      if (!dailyPortfolioDataRaw) {
        return Result.err(new NotFoundError({resource: "Wallet Snapshots"}));
      }

      const displayCurrencyRaw = await QUERIES.getUserDisplayCurrency(user.session.userId);
      if (!displayCurrencyRaw) {
        return Result.err(new NotFoundError({resource: "User displayCurrency"}));
      }

      const displayCurrency = displayCurrencyRaw[0].displayCurrency;

      const needsFxRates = dailyPortfolioDataRaw.some(
        (data) => data.walletCurrency !== displayCurrency
      );

      type FxRateWithDateStr = Awaited<ReturnType<typeof QUERIES.getFxRatesInRange>>[number] & {
        dateStr: string;
      };

      let allRates: FxRateWithDateStr[] = [];
      if (needsFxRates) {
        const [ratesInRange, fallbackRate] = await Promise.all([
          QUERIES.getFxRatesInRange(startDate, currentDate),
          QUERIES.getFxRateBefore(startDate)
        ])

        allRates = [
          ...(fallbackRate ? [fallbackRate] : []),
          ...ratesInRange,
        ]
          .sort((a, b) => a.asOf.getTime() - b.asOf.getTime())
          .map((r) => ({ ...r, dateStr: r.asOf.toISOString().split("T")[0] }));

        if (allRates.length === 0) {
          return Result.err(new NotFoundError({resource: "No currency rates"}));
        }
      }

      const byDate = new Map<string, {
        timestamp: number,
        label: string,
        totalValue: number,
        totalCostBasis: number
      }>();

      let currentRate: typeof allRates[number] | null = null;
      let rateIdx = 0;
      for (const data of dailyPortfolioDataRaw) {
        const snapshotDate = data.snapshotDate;

        if (needsFxRates) {
          while (rateIdx < allRates.length && allRates[rateIdx].dateStr <= snapshotDate) {
            currentRate = allRates[rateIdx];
            rateIdx += 1;
          }

          if (currentRate == null) {
            currentRate = allRates[0];
          }
        }

        let totalValue = Number(data.totalValue);
        let totalCostBasis = Number(data.totalCostBasis);

        if (data.walletCurrency !== displayCurrency) {
          if (currentRate == null) {
            return Result.err(new NotFoundError({resource: "No currency rates"}));
          }

          if (data.walletCurrency === "USD") {
            totalValue = totalValue * currentRate.rate;
            totalCostBasis = totalCostBasis * currentRate.rate;
          } else {
            totalValue = totalValue / currentRate.rate;
            totalCostBasis = totalCostBasis / currentRate.rate;
          }
        }

        const existingPoint = byDate.get(snapshotDate);

        if (existingPoint) {
          existingPoint.totalValue += totalValue;
          existingPoint.totalCostBasis += totalCostBasis;
        } else {
          byDate.set(snapshotDate, {
            timestamp: new Date(snapshotDate).getTime(),
            label: snapshotDate,
            totalValue,
            totalCostBasis,
          });
        }
      }

      const dailyData = Array.from(byDate.values()).sort(
        (a, b) => a.timestamp - b.timestamp
      );

      return Result.ok(dailyData);
    } else {
      return Result.err(new ValidationError({ field: "range", message: "Unsupported time range for chart data" }));
    }
  })
}
