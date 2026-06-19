"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { Result } from "better-result";
import { z } from "zod";

import { getSession } from "../../better-auth/session";
import { db } from "../../db";
import { numToNumericString } from "../../db/numeric";
import { QUERIES } from "../../db/queries";
import { portfolioTransaction, position, wallet } from "../../db/schema";
import {
  DatabaseError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
  type PositionError,
} from "../../errors";

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
  withdrawAfterSale: z.boolean(),
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
  return Result.gen(async function* () {
    const session = await getSession();
    if (!session) {
      return Result.err(new UnauthenticatedError());
    }

    const userWallet = await QUERIES.getWalletById(walletId, session.session.userId);
    if (!userWallet) {
      return Result.err(new NotFoundError({ resource: "Wallet", id: walletId }));
    }

    const price = formData.get("price");
    const withdrawAfterSale = formData.has("withdrawAfterSale");

    const parsed = sellAllSchema.safeParse({
      price,
      withdrawAfterSale,
      withdrawAmount: withdrawAfterSale ? formData.get("withdrawAmount") : "0",
    });

    if (!parsed.success) {
      const errors = z.flattenError(parsed.error);
      return Result.err(
        new ValidationError({
          message: "Invalid input",
          fieldErrors: {
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
            const positionsToSell = await tx
              .select({
                id: position.id,
                companyName: position.companyName,
                companySymbol: position.companySymbol,
                pricePerShare: sql<number>`(${position.pricePerShare})::double precision`,
                quantity: sql<number>`(${position.quantity})::double precision`,
              })
              .from(position)
              .innerJoin(wallet, eq(position.walletId, wallet.id))
              .where(
                and(
                  eq(position.walletId, walletId),
                  eq(wallet.userId, session.session.userId),
                  eq(position.companySymbol, companySymbol),
                  gt(position.quantity, "0"),
                  isNull(position.closedAt),
                  isNull(wallet.deletedAt)
                )
              )
              .for("update");

            if (positionsToSell.length === 0) {
              throw new NotFoundError({ resource: "No active positions for symbol", id: companySymbol });
            }

            let totalQuantity = 0;
            let totalRealizedPl = 0;

            for (const pos of positionsToSell) {
              totalQuantity += pos.quantity;
              totalRealizedPl += (parsed.data.price - pos.pricePerShare) * pos.quantity;
            }

            const totalProceeds = totalQuantity * parsed.data.price;
            const withdrawal = parsed.data.withdrawAfterSale ? parsed.data.withdrawAmount : 0;

            if (withdrawal > totalProceeds) {
              throw new ValidationError({
                message: "Withdrawal amount cannot exceed proceeds from sale",
                fieldErrors: { withdrawAmount: "Withdrawal amount cannot exceed proceeds from sale" },
              });
            }

            const closedAt = new Date();

            for (const pos of positionsToSell) {
              const proceeds = pos.quantity * parsed.data.price;
              const realizedPl = (parsed.data.price - pos.pricePerShare) * pos.quantity;

              await tx.insert(portfolioTransaction).values({
                id: randomUUID(),
                walletId,
                positionId: pos.id,
                type: "SELL",
                companyName: pos.companyName,
                companySymbol: pos.companySymbol,
                quantity: numToNumericString(pos.quantity),
                pricePerShare: numToNumericString(parsed.data.price),
                transactionValue: numToNumericString(proceeds),
                cashUsed: "0",
                externalContribution: "0",
                realizedPl: numToNumericString(realizedPl),
              });

              await tx
                .update(position)
                .set({
                  quantity: "0",
                  closedAt,
                })
                .where(
                  and(
                    eq(position.walletId, walletId),
                    eq(position.id, pos.id),
                    eq(position.companySymbol, companySymbol),
                    gt(position.quantity, "0"),
                    isNull(position.closedAt)
                  )
                );
            }

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
                cashBalance: sql`${wallet.cashBalance} + ${numToNumericString(totalProceeds - withdrawal)}`,
                realizedPl: sql`${wallet.realizedPl} + ${numToNumericString(totalRealizedPl)}`,
                totalWithdrawn: sql`${wallet.totalWithdrawn} + ${numToNumericString(withdrawal)}`,
              })
              .where(
                and(
                  eq(wallet.id, walletId),
                  eq(wallet.userId, session.session.userId),
                  isNull(wallet.deletedAt)
                )
              );
          });
        },
        catch: (e) => {
          if (e instanceof NotFoundError || e instanceof ValidationError) {
            return e;
          } else {
            return new DatabaseError({ operation: "sell all positions for symbol", cause: e });
          }
        },
      })
    );

    revalidatePath(`/dashboard/${walletId}`);

    return Result.ok(undefined);
  });
}
