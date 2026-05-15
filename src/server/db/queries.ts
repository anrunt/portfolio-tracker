import { and, asc, desc, eq, gt, gte, isNull, lte, sql } from "drizzle-orm";
import { db } from ".";
import { fxRates, position, user, wallet, walletDailySnapshot, walletIntradaySnapshot } from "./schema";

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
        totalValue: sql<number>`coalesce(sum(${position.quantity} * ${position.pricePerShare}), 0::numeric)::double precision`
      })
      .from(wallet)
      .leftJoin(position, eq(wallet.id, position.walletId))
      .where(and(eq(wallet.userId, userId), isNull(wallet.deletedAt)))
      .groupBy(wallet.id)
  },

  getWalletsWithLatestSnapshot: function (userId: string) {
    const latestSnapshot = db
      .select({
        totalValue: sql<number>`(${walletIntradaySnapshot.totalValue})::double precision`.as("total_value"),
        totalCostBasis: sql<number>`(${walletIntradaySnapshot.totalCostBasis})::double precision`.as("total_cost_basis"),
        snapshotAt: walletIntradaySnapshot.snapshotAt,
      })
      .from(walletIntradaySnapshot)
      .where(eq(walletIntradaySnapshot.walletId, wallet.id))
      .orderBy(desc(walletIntradaySnapshot.snapshotAt))
      .limit(1)
      .as("latest_snapshot");

    const walletCostBasis = db
      .select({
        fallbackCostBasis: sql<number>`coalesce(sum(${position.quantity} * ${position.pricePerShare}), 0::numeric)::double precision`.as("fallback_cost_basis"),
      })
      .from(position)
      .where(eq(position.walletId, wallet.id))
      .as("wallet_cost_basis");

    return db
      .select({
        id: wallet.id,
        name: wallet.name,
        userId: wallet.userId,
        currency: wallet.currency,
        createdAt: wallet.createdAt,
        totalValue: sql<number>`coalesce(${latestSnapshot.totalValue}, ${walletCostBasis.fallbackCostBasis})`.as("total_value"),
        totalCostBasis: latestSnapshot.totalCostBasis,
        snapshotAt: latestSnapshot.snapshotAt,
        hasSnapshot: sql<boolean>`${latestSnapshot.snapshotAt} is not null`.as("has_snapshot"),
      })
      .from(wallet)
      .leftJoinLateral(latestSnapshot, sql`true`)
      .leftJoinLateral(walletCostBasis, sql`true`)
      .where(and(eq(wallet.userId, userId), isNull(wallet.deletedAt)));
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
        pricePerShare: sql<number>`(${position.pricePerShare})::double precision`,
        quantity: sql<number>`(${position.quantity})::double precision`,
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
          pricePerShare: sql<number>`(${position.pricePerShare})::double precision`,
          quantity: sql<number>`(${position.quantity})::double precision`,
          createdAt: position.createdAt,
        },
      })
      .from(wallet)
      .innerJoin(position, eq(wallet.id, position.walletId))
      .where(isNull(wallet.deletedAt))
  },

  getDailyPortfolioData: function(walletId: string, startDate: string) {
    return db
      .select({
        id: walletDailySnapshot.id,
        walletId: walletDailySnapshot.walletId,
        totalValue: sql<number>`(${walletDailySnapshot.totalValue})::double precision`,
        totalCostBasis: sql<number>`(${walletDailySnapshot.totalCostBasis})::double precision`,
        snapshotDate: walletDailySnapshot.snapshotDate,
        createdAt: walletDailySnapshot.createdAt,
      })
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
      .select({
        id: walletIntradaySnapshot.id,
        walletId: walletIntradaySnapshot.walletId,
        totalValue: sql<number>`(${walletIntradaySnapshot.totalValue})::double precision`,
        totalCostBasis: sql<number>`(${walletIntradaySnapshot.totalCostBasis})::double precision`,
        snapshotAt: walletIntradaySnapshot.snapshotAt,
        createdAt: walletIntradaySnapshot.createdAt,
      })
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
        walletId: walletIntradaySnapshot.walletId,
        walletCurrency: wallet.currency,
        totalValue: sql<number>`(${walletIntradaySnapshot.totalValue})::double precision`,
        totalCostBasis: sql<number>`(${walletIntradaySnapshot.totalCostBasis})::double precision`,
      })
      .from(walletIntradaySnapshot)
      .innerJoin(wallet, eq(wallet.id, walletIntradaySnapshot.walletId))
      .where(
        and(
          eq(wallet.userId, userId),
          isNull(wallet.deletedAt),
          gte(walletIntradaySnapshot.snapshotAt, startOfToday)
        )
      )
      .orderBy(
        asc(walletIntradaySnapshot.snapshotAt),
      );
  },
  // Need to change this -> Now i just sum wallet and dont care about currency which is wrong
//  getAllWalletsIntradayPortfolioData: function(userId: string, startOfToday: Date) {
//    return db
//      .select({
//        snapshotAt: walletIntradaySnapshot.snapshotAt,
//        totalValue: sql<number>`coalesce(sum(${walletIntradaySnapshot.totalValue}), 0::numeric)::double precision`,
//        totalCostBasis: sql<number>`coalesce(sum(${walletIntradaySnapshot.totalCostBasis}), 0::numeric)::double precision`
//      })
//      .from(walletIntradaySnapshot)
//      .innerJoin(wallet, eq(wallet.id, walletIntradaySnapshot.walletId))
//      .where(
//        and(
//          eq(wallet.userId, userId),
//          gte(walletIntradaySnapshot.snapshotAt, startOfToday),
//        )
//      )
//      .groupBy(walletIntradaySnapshot.snapshotAt)
//      .orderBy(asc(walletIntradaySnapshot.snapshotAt))
//  },
//
  getAllWalletsDailyPortfolioData: function(userId: string, startDate: string) {
    return db
      .select({
        snapshotDate: walletDailySnapshot.snapshotDate,
        walletId: walletDailySnapshot.walletId,
        walletCurrency: wallet.currency,
        totalValue: sql<number>`(${walletDailySnapshot.totalValue})::double precision`,
        totalCostBasis: sql<number>`(${walletDailySnapshot.totalCostBasis}):: double precision`
      })
      .from(walletDailySnapshot)
      .innerJoin(wallet, eq(wallet.id, walletDailySnapshot.walletId))
      .where(
        and(
          eq(wallet.userId, userId),
          isNull(wallet.deletedAt),
          gte(walletDailySnapshot.snapshotDate, startDate)
        )
      )
      .orderBy(
        asc(walletDailySnapshot.snapshotDate),
      )
  },
//  getAllWalletsDailyPortfolioData: function(userId: string, startDate: string) {
//    return db
//      .select({
//        snapshotDate: walletDailySnapshot.snapshotDate,
//        totalValue: sql<number>`coalesce(sum(${walletDailySnapshot.totalValue}), 0::numeric)::double precision`,
//        totalCostBasis: sql<number>`coalesce(sum(${walletDailySnapshot.totalCostBasis}), 0::numeric)::double precision`
//      })
//      .from(walletDailySnapshot)
//      .innerJoin(wallet, eq(wallet.id, walletDailySnapshot.walletId))
//      .where(
//        and(
//          eq(wallet.userId, userId),
//          gte(walletDailySnapshot.snapshotDate, startDate),
//        )
//      )
//      .groupBy(walletDailySnapshot.snapshotDate)
//      .orderBy(asc(walletDailySnapshot.snapshotDate))
//  }

  getUserDisplayCurrency: function (userId: string) {
    return db
      .select({
        displayCurrency: user.displayCurrency
      })
      .from(user)  
      .where(eq(user.id, userId))
  },

  getFxRateBefore: async function (startDate: Date) {
    return db
      .select({
        rate: sql<number>`(${fxRates.rate})::double precision`,
        asOf: fxRates.asOf,
        baseCurrency: fxRates.baseCurrency,
        quoteCurrency: fxRates.quoteCurrency,
      })
      .from(fxRates)
      .where(
        and(
          eq(fxRates.baseCurrency, "USD"),
          eq(fxRates.quoteCurrency, "PLN"),
          eq(fxRates.granularity, "daily"),
          eq(fxRates.source, "nbp"),
          lte(fxRates.asOf, startDate)
        )
      )
      .orderBy(desc(fxRates.asOf))
      .limit(1)
      .then((rows) => rows[0] ?? null)
  },


  getFxRatesInRange: function(startDate: Date, endDate: Date) {
    return db
      .select({
        rate: sql<number>`(${fxRates.rate})::double precision`,
        asOf: fxRates.asOf,
        baseCurrency: fxRates.baseCurrency,
        quoteCurrency: fxRates.quoteCurrency,
      })
      .from(fxRates)
      .where(
        and(
          eq(fxRates.baseCurrency, "USD"),
          eq(fxRates.quoteCurrency, "PLN"),
          eq(fxRates.granularity, "daily"),
          eq(fxRates.source, "nbp"),
          gt(fxRates.asOf, startDate),
          lte(fxRates.asOf, endDate)
        )
      )
      .orderBy(asc(fxRates.asOf))
  }
};
