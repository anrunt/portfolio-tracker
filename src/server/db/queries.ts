import { and, asc, eq, gte, isNull, sql } from "drizzle-orm";
import { db } from ".";
import { position, wallet, walletDailySnapshot, walletIntradaySnapshot } from "./schema";

export const QUERIES = {
  getWallets: function (userId: string) {
    return db
      .select()
      .from(wallet)
      .where(and(eq(wallet.userId, userId), isNull(wallet.deletedAt)));
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
      .where(and(eq(wallet.userId, userId), isNull(wallet.deletedAt)))
      .groupBy(wallet.id)
  },

  getWalletById: async function (walletId: string, userId: string) {
    return db
      .select()
      .from(wallet)
      .where(and(eq(wallet.id, walletId), eq(wallet.userId, userId), isNull(wallet.deletedAt)))
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
      .where(and(eq(position.walletId, walletId), eq(wallet.userId, userId), isNull(wallet.deletedAt)));
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
      .where(isNull(wallet.deletedAt))
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
      .orderBy(asc(walletIntradaySnapshot.snapshotAt))
  },

  getAllWalletsIntradayPortfolioData: function(userId: string, startOfToday: Date) {
    return db
      .select({
        snapshotAt: walletIntradaySnapshot.snapshotAt,
        totalValue: sql<number>`sum(${walletIntradaySnapshot.totalValue})`,
        totalCostBasis: sql<number>`sum(${walletIntradaySnapshot.totalCostBasis})`
      })
      .from(walletIntradaySnapshot)
      .innerJoin(wallet, eq(wallet.id, walletIntradaySnapshot.walletId))
      .where(
        and(
          eq(wallet.userId, userId),
          gte(walletIntradaySnapshot.snapshotAt, startOfToday),
        )
      )
      .groupBy(walletIntradaySnapshot.snapshotAt)
      .orderBy(asc(walletIntradaySnapshot.snapshotAt))
  },

  getAllWalletsDailyPortfolioData: function(userId: string, startDate: string) {
    return db
      .select({
        snapshotDate: walletDailySnapshot.snapshotDate,
        totalValue: sql<number>`sum(${walletDailySnapshot.totalValue})`,
        totalCostBasis: sql<number>`sum(${walletDailySnapshot.totalCostBasis})`
      })
      .from(walletDailySnapshot)
      .innerJoin(wallet, eq(wallet.id, walletDailySnapshot.walletId))
      .where(
        and(
          eq(wallet.userId, userId),
          gte(walletDailySnapshot.snapshotDate, startDate),
        )
      )
      .groupBy(walletDailySnapshot.snapshotDate)
      .orderBy(asc(walletDailySnapshot.snapshotDate))
  }
};
