"use server";

import { revalidatePath } from "next/cache";
import { and, eq, isNull, sql } from "drizzle-orm";
import { Result } from "better-result";

import { getSession } from "../../better-auth/session";
import { db } from "../../db";
import { QUERIES } from "../../db/queries";
import { portfolioTransaction, position, wallet } from "../../db/schema";
import {
  DatabaseError,
  NotFoundError,
  UnauthenticatedError,
  UnauthorizedError,
  ValidationError,
  type PositionError,
} from "../../errors";

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
