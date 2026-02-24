import { and, asc, eq, gte, sql } from "drizzle-orm";
import { db } from ".";
import { position, wallet, walletDailySnapshot, walletIntradaySnapshot } from "./schema";

export const QUERIES = {
  getWallets: function (userId: string) {
    return db.select().from(wallet).where(eq(wallet.userId, userId));
  },

  getWalletsWithTotalValue: function (userId: string) {
    return db
      .select({
        id: wallet.id,
        name: wallet.name,
        userId: wallet.userId,
        currency: wallet.currency,
        createdAt: wallet.createdAt,
        totalValue: sql<number>`coalesce(sum(${position.quantity} * ${position.pricePerShare}), 0)`
      })
      .from(wallet)
      .leftJoin(position, eq(wallet.id, position.walletId))
      .where(eq(wallet.userId, userId))
      .groupBy(wallet.id)
  },

  getWalletById: async function (walletId: string, userId: string) {
    return db
      .select()
      .from(wallet)
      .where(and(eq(wallet.id, walletId), eq(wallet.userId, userId)))
      .limit(1)
      .then((result) => result[0]);
  },

  getWalletPositions: function (walletId: string, userId: string) {
    return db
      .select({
        id: position.id,
        companyName: position.companyName,
        companySymbol: position.companySymbol,
        pricePerShare: position.pricePerShare,
        quantity: position.quantity,
        createdAt: position.createdAt,
      })
      .from(position)
      .innerJoin(wallet, eq(position.walletId, wallet.id))
      .where(and(eq(position.walletId, walletId), eq(wallet.userId, userId)));
  },

  getAllWalletsWithPositions: function() {
    return db
      .select({
        wallet: {
          id: wallet.id,
          name: wallet.name,
          userId: wallet.userId,
          currency: wallet.currency,
          createdAt: wallet.createdAt,
        },
        position: {
          id: position.id,
          walletId: position.walletId,
          companyName: position.companyName,
          companySymbol: position.companySymbol,
          pricePerShare: position.pricePerShare,
          quantity: position.quantity,
          createdAt: position.createdAt,
        },
      })
      .from(wallet)
      .innerJoin(position, eq(wallet.id, position.walletId))
  },

  getDailyPortfolioData: function(walletId: string, startDate: string) {
    return db
      .select()
      .from(walletDailySnapshot)
      .where(
        and(
          eq(walletDailySnapshot.walletId, walletId),
          gte(walletDailySnapshot.snapshotDate, startDate)
        )
      )
      .orderBy(asc(walletDailySnapshot.snapshotDate))
  },

  getIntradayPortfolioData: function(walletId: string, startOfToday: Date) {
    return db
      .select()
      .from(walletIntradaySnapshot)
      .where(
        and(
          eq(walletIntradaySnapshot.walletId, walletId),
          gte(walletIntradaySnapshot.snapshotAt, startOfToday)
        )
      )
  }
};
