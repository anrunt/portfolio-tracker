import {
  and,
  asc,
  desc,
  eq,
  gt,
  gte,
  ilike,
  inArray,
  isNotNull,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import { db } from ".";
import { fxRates, portfolioTransaction, position, user, wallet, walletDailySnapshot, walletIntradaySnapshot } from "./schema";

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
        netInvested: sql<number>`(${walletIntradaySnapshot.netInvested})::double precision`.as("net_invested"),
        snapshotAt: walletIntradaySnapshot.snapshotAt,
      })
      .from(walletIntradaySnapshot)
      .where(eq(walletIntradaySnapshot.walletId, wallet.id))
      .orderBy(desc(walletIntradaySnapshot.snapshotAt))
      .limit(1)
      .as("latest_snapshot");

    const walletFallback = db
      .select({
        holdingsValue: sql<number>`coalesce(sum(${position.quantity} * ${position.pricePerShare}), 0::numeric)::double precision`.as("holdings_value"),
      })
      .from(position)
      .where(
        and(
          eq(position.walletId, wallet.id),
          gt(position.quantity, "0"),
          isNull(position.closedAt)
        )
      )
      .as("wallet_fallback");

    return db
      .select({
        id: wallet.id,
        name: wallet.name,
        userId: wallet.userId,
        currency: wallet.currency,
        createdAt: wallet.createdAt,
        totalValue: sql<number>`coalesce(${latestSnapshot.totalValue}, ${walletFallback.holdingsValue} + (${wallet.cashBalance})::double precision)`.as("total_value"),
        netInvested: sql<number>`coalesce(${latestSnapshot.netInvested}, (${wallet.totalContributed})::double precision - (${wallet.totalWithdrawn})::double precision)`.as("net_invested"),
        snapshotAt: latestSnapshot.snapshotAt,
      })
      .from(wallet)
      .leftJoinLateral(latestSnapshot, sql`true`)
      .leftJoinLateral(walletFallback, sql`true`)
      .where(and(eq(wallet.userId, userId), isNull(wallet.deletedAt)));
  },

  getWalletById: async function (walletId: string, userId: string) {
    return db
      .select({
        id: wallet.id,
        name: wallet.name,
        userId: wallet.userId,
        currency: wallet.currency,
        createdAt: wallet.createdAt,
        deletedAt: wallet.deletedAt,
        cashBalance: sql<number>`(${wallet.cashBalance})::double precision`,
        totalBuyCost: sql<number>`(${wallet.totalBuyCost})::double precision`,
        totalContributed: sql<number>`(${wallet.totalContributed})::double precision`,
        totalWithdrawn: sql<number>`(${wallet.totalWithdrawn})::double precision`,
        realizedPl: sql<number>`(${wallet.realizedPl})::double precision`,
      })
      .from(wallet)
      .where(and(eq(wallet.id, walletId), eq(wallet.userId, userId), isNull(wallet.deletedAt)))
      .limit(1)
      .then((result) => result[0]);
  },

  getActiveWalletByNameAndCurrency: async function (
    userId: string,
    name: string,
    currency: "USD" | "PLN"
  ) {
    return db
      .select({ id: wallet.id })
      .from(wallet)
      .where(
        and(
          eq(wallet.userId, userId),
          eq(wallet.name, name),
          eq(wallet.currency, currency),
          isNull(wallet.deletedAt)
        )
      )
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
        initialQuantity: sql<number>`(${position.initialQuantity})::double precision`,
        createdAt: position.createdAt,
        closedAt: position.closedAt,
      })
      .from(position)
      .innerJoin(wallet, eq(position.walletId, wallet.id))
      .where(
        and(
          eq(position.walletId, walletId), 
          eq(wallet.userId, userId),
          gt(position.quantity, "0"), 
          isNull(position.closedAt),
          isNull(wallet.deletedAt)
        )
      );
  },

  getPositionLotById: async function (positionId: string, walletId: string, userId: string) {
    return db
      .select({
        id: position.id,
        walletId: position.walletId,
        companyName: position.companyName,
        companySymbol: position.companySymbol,
        pricePerShare: sql<number>`(${position.pricePerShare})::double precision`,
        quantity: sql<number>`(${position.quantity})::double precision`,
        initialQuantity: sql<number>`(${position.initialQuantity})::double precision`,
        closedAt: position.closedAt,
        createdAt: position.createdAt,
      })
      .from(position)
      .innerJoin(wallet, eq(position.walletId, wallet.id))
      .where(
        and(
          eq(position.id, positionId),
          eq(position.walletId, walletId),
          eq(wallet.userId, userId),
          isNull(wallet.deletedAt)
        )
      )
      .limit(1)
      .then((rows) => rows[0]);
  },

  getPositionSellTransactions: function (positionId: string, walletId: string, userId: string) {
    return db
      .select({
        id: portfolioTransaction.id,
        walletId: portfolioTransaction.walletId,
        positionId: portfolioTransaction.positionId,
        type: portfolioTransaction.type,
        companyName: portfolioTransaction.companyName,
        companySymbol: portfolioTransaction.companySymbol,
        quantity: sql<number>`(${portfolioTransaction.quantity})::double precision`,
        pricePerShare: sql<number>`(${portfolioTransaction.pricePerShare})::double precision`,
        transactionValue: sql<number>`(${portfolioTransaction.transactionValue})::double precision`,
        cashUsed: sql<number>`(${portfolioTransaction.cashUsed})::double precision`,
        externalContribution: sql<number>`(${portfolioTransaction.externalContribution})::double precision`,
        realizedPl: sql<number>`(${portfolioTransaction.realizedPl})::double precision`,
        createdAt: portfolioTransaction.createdAt,
      })
      .from(portfolioTransaction)
      .innerJoin(wallet, eq(portfolioTransaction.walletId, wallet.id))
      .where(
        and(
          eq(portfolioTransaction.positionId, positionId),
          eq(portfolioTransaction.walletId, walletId),
          eq(portfolioTransaction.type, "SELL"),
          eq(wallet.userId, userId),
          isNull(wallet.deletedAt)
        )
      );
  },

  getUserTransactionHistory: function(
    userId: string,
    companyNameOrSymbol: string,
    walletName?: string
  ) {
    return db
      .select({
        wallet: {
          id: wallet.id,
          name: wallet.name,
          currency: wallet.currency,
        },
        transaction: {
          type: portfolioTransaction.type,
          companyName: portfolioTransaction.companyName,
          companySymbol: portfolioTransaction.companySymbol,
          quantity: sql<number>`(${portfolioTransaction.quantity})::double precision`,
          pricePerShare: sql<number>`(${portfolioTransaction.pricePerShare})::double precision`,
          transactionValue: sql<number>`(${portfolioTransaction.transactionValue})::double precision`,
          realizedPl: sql<number>`(${portfolioTransaction.realizedPl})::double precision`,
          createdAt: portfolioTransaction.createdAt,
        },
      })
      .from(portfolioTransaction)
      .innerJoin(wallet, eq(portfolioTransaction.walletId, wallet.id))
      .where(
        and(
          eq(wallet.userId, userId),
          isNull(wallet.deletedAt),
          inArray(portfolioTransaction.type, ["BUY", "SELL"]),
          isNotNull(portfolioTransaction.quantity), // Always not null but i need to make ts happy 
          isNotNull(portfolioTransaction.pricePerShare), // Always not null but i need to make ts happy 
          or(
            ilike(portfolioTransaction.companySymbol, companyNameOrSymbol),
            ilike(portfolioTransaction.companyName, `%${companyNameOrSymbol}%`)
          ),
          walletName ? ilike(wallet.name, walletName) : undefined // If wallet present, we filter by its name, if not we skip it and return all wallets
        )
      )
      .orderBy(desc(portfolioTransaction.createdAt));
  },

  getActivePositionsBySymbol: function (walletId: string, userId: string, companySymbol: string) {
    return db
      .select({
        id: position.id,
        walletId: position.walletId,
        companyName: position.companyName,
        companySymbol: position.companySymbol,
        pricePerShare: sql<number>`(${position.pricePerShare})::double precision`,
        quantity: sql<number>`(${position.quantity})::double precision`,
        initialQuantity: sql<number>`(${position.initialQuantity})::double precision`,
        closedAt: position.closedAt,
        createdAt: position.createdAt,
      })
      .from(position)
      .innerJoin(wallet, eq(position.walletId, wallet.id))
      .where(
        and(
          eq(position.walletId, walletId),
          eq(wallet.userId, userId),
          eq(position.companySymbol, companySymbol),
          gt(position.quantity, "0"),
          isNull(position.closedAt),
          isNull(wallet.deletedAt)
        )
      );
  },

  getWalletCashBalance: async function (walletId: string, userId: string) {
    return db
      .select({
        cashBalance: sql<number>`(${wallet.cashBalance})::double precision`,
      })
      .from(wallet)
      .where(
        and(
          eq(wallet.id, walletId),
          eq(wallet.userId, userId),
          isNull(wallet.deletedAt)
        )
      )
      .limit(1)
      .then((rows) => rows[0]);
  },

  getAllWalletsWithPositions: function() {
    return db
      .select({
        wallet: {
          id: wallet.id,
          name: wallet.name,
          userId: wallet.userId,
          currency: wallet.currency,
          cashBalance: sql<number>`(${wallet.cashBalance})::double precision`,
          totalContributed: sql<number>`(${wallet.totalContributed})::double precision`,
          totalWithdrawn: sql<number>`(${wallet.totalWithdrawn})::double precision`,
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
      .leftJoin(position, 
        and(
          eq(wallet.id, position.walletId), // Left join to include wallets without positions but with cash balance
          gt(position.quantity, "0"),
          isNull(position.closedAt)
        ))
      .where(isNull(wallet.deletedAt))
  },

  getUserWalletsWithPositions: function(userId: string) {
    return db
      .select({
        wallet: {
          id: wallet.id,
          name: wallet.name,
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
      .leftJoin(
        position,
        and(
          eq(wallet.id, position.walletId),
          gt(position.quantity, "0"),
          isNull(position.closedAt)
        )
      )
      .where(
        and(
          eq(wallet.userId, userId),
          isNull(wallet.deletedAt)
        )
      );
  },

  getDailyPortfolioData: function(walletId: string, startDate: string) {
    return db
      .select({
        id: walletDailySnapshot.id,
        walletId: walletDailySnapshot.walletId,
        totalValue: sql<number>`(${walletDailySnapshot.totalValue})::double precision`,
        netInvested: sql<number>`(${walletDailySnapshot.netInvested})::double precision`,
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
        netInvested: sql<number>`(${walletIntradaySnapshot.netInvested})::double precision`,
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
        netInvested: sql<number>`(${walletIntradaySnapshot.netInvested})::double precision`,
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

  getAllWalletsDailyPortfolioData: function(userId: string, startDate: string) {
    return db
      .select({
        snapshotDate: walletDailySnapshot.snapshotDate,
        walletId: walletDailySnapshot.walletId,
        walletCurrency: wallet.currency,
        totalValue: sql<number>`(${walletDailySnapshot.totalValue})::double precision`,
        netInvested: sql<number>`(${walletDailySnapshot.netInvested})::double precision`
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
