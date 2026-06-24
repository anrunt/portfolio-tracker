"use server";

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
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
import type { FieldErrors } from "../types";

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
