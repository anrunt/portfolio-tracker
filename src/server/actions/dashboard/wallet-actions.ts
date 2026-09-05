"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Result } from "better-result";
import { z } from "zod";

import {
  SUPPORTED_CURRENCIES,
  supportedCurrencySchema,
} from "@/domain/currency";
import { getSession } from "../../better-auth/session";
import { db } from "../../db";
import { numToNumericString } from "../../db/numeric";
import { QUERIES } from "../../db/queries";
import { portfolioTransaction, wallet, walletNetInvestedBalance } from "../../db/schema";
import {
  DatabaseError,
  NotFoundError,
  UnauthenticatedError,
  ValidationError,
  type WalletError,
} from "../../errors";
import { applyWalletNetInvestedChange } from "@/server/services/update-wallet-net-invested-balance";

const walletSchema = z.object({
  name: z
    .string({ error: "Wallet name is required" })
    .trim()
    .min(2, { error: "Wallet name must be at least 2 characters" })
    .max(50, { error: "Wallet name can't be longer than 50 characters!" }),
  currency: supportedCurrencySchema,
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

    const existingWallet = await QUERIES.getActiveWalletByNameAndCurrency(
      user.session.userId,
      parsed.data.name,
      parsed.data.currency
    );

    if (existingWallet) {
      return Result.err(
        new ValidationError({
          message: "A wallet with this name and currency already exists.",
        })
      );
    }

    console.log("Adding wallet:", { name, currency });

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db.transaction(async (tx) => {
            const walletId = randomUUID();

            await tx.insert(wallet).values({
              id: walletId,
              name: parsed.data.name,
              userId: user.session.userId,
              currency: parsed.data.currency,
            })

            await tx.insert(walletNetInvestedBalance).values(
              SUPPORTED_CURRENCIES.map((currency) => ({ walletId, currency })),
            )

          })
        },
        catch: (e) => new DatabaseError({ operation: "insert wallet with balances", cause: e }),
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

    const existingWallet = await QUERIES.getActiveWalletByNameAndCurrency(
      user.session.userId,
      parsedName.data.name,
      userWallet.currency
    );

    if (existingWallet && existingWallet.id !== walletId) {
      return Result.err(
        new ValidationError({
          message: "A wallet with this name and currency already exists.",
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
        catch: (e) => new DatabaseError({ operation: "rename wallet", cause: e }),
      })
    )

    revalidatePath("/dashboard");

    return Result.ok(undefined);
  })
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

type WithdrawalState = {
  message: string;
  success: boolean;
  timestamp: number;
  fieldErrors?: {
    withdrawAmount?: string;
  };
};

const withdrawalSchema = z.object({
  withdrawAmount: z
    .string({ error: "Withdrawal amount is required" })
    .trim()
    .min(1, { error: "Withdrawal amount is required" })
    .transform(Number)
    .pipe(
      z
        .number({ error: "Withdrawal amount must be a valid number" })
        .positive({ error: "Withdrawal amount must be greater than 0" })
    ),
});

export async function withdrawCash(
  walletId: string,
  prevState: WithdrawalState,
  formData: FormData
): Promise<WithdrawalState> {
  const result = await withdrawCashResult(walletId, formData);

  return result.match({
    ok: () => ({ message: "", success: true as boolean, timestamp: Date.now() }),
    err: (e) => ({
      message: e.message,
      success: false as boolean,
      timestamp: Date.now(),
      fieldErrors: "fieldErrors" in e
        ? { withdrawAmount: e.fieldErrors?.withdrawAmount }
        : undefined,
    }),
  });
}

export async function withdrawCashResult(
  walletId: string,
  formData: FormData
): Promise<Result<void, WalletError>> {
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    const parsed = withdrawalSchema.safeParse({
      withdrawAmount: formData.get("withdrawAmount"),
    });

    if (!parsed.success) {
      const errors = z.flattenError(parsed.error);

      return Result.err(
        new ValidationError({
          message: "Invalid withdrawal amount",
          fieldErrors: {
            withdrawAmount: errors.fieldErrors.withdrawAmount?.[0],
          },
        })
      );
    }

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db.transaction(async (tx) => {
            const userWallet = await tx
              .select({
                id: wallet.id,
                cashBalance: sql<number>`(${wallet.cashBalance})::double precision`,
                currency: wallet.currency
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

            if (!userWallet) {
              throw new NotFoundError({ resource: "Wallet", id: walletId });
            }

            if (parsed.data.withdrawAmount > userWallet.cashBalance) {
              throw new ValidationError({
                message: "Withdrawal amount cannot exceed cash balance",
                fieldErrors: { withdrawAmount: "Withdrawal amount cannot exceed cash balance" },
              });
            }

            const withdrawalDate = new Date();

            await tx.insert(portfolioTransaction).values({
              id: randomUUID(),
              walletId,
              positionId: null,
              type: "WITHDRAWAL",
              companyName: null,
              companySymbol: null,
              quantity: null,
              pricePerShare: null,
              transactionValue: numToNumericString(parsed.data.withdrawAmount),
              cashUsed: "0",
              externalContribution: "0",
              realizedPl: "0",
              createdAt: withdrawalDate 
            });

            await tx
              .update(wallet)
              .set({
                cashBalance: sql`${wallet.cashBalance} - ${numToNumericString(parsed.data.withdrawAmount)}`,
                totalWithdrawn: sql`${wallet.totalWithdrawn} + ${numToNumericString(parsed.data.withdrawAmount)}`,
              })
              .where(
                and(
                  eq(wallet.id, walletId),
                  eq(wallet.userId, user.session.userId),
                  isNull(wallet.deletedAt)
                )
              );

            await applyWalletNetInvestedChange(
              tx,
              walletId,
              userWallet.currency,
              parsed.data.withdrawAmount,
              "decrease",
              withdrawalDate
            );
          });
        },
        catch: (e) =>
          e instanceof NotFoundError || e instanceof ValidationError
            ? e
            : new DatabaseError({ operation: "withdraw cash", cause: e }),
      })
    );

    revalidatePath(`/dashboard/${walletId}`);

    return Result.ok(undefined);
  });
}
