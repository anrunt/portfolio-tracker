import type { QUERIES } from "../db/queries";
import { db } from "../db";
import { numToNumericString } from "../db/numeric";
import { fxRates, position, wallet, walletDailySnapshot, walletIntradaySnapshot, walletNetInvestedBalance } from "../db/schema";
import { and, eq, gt, isNull, lte, sql } from "drizzle-orm";
import { getUsdPlnRate } from "./getUsdPlnRate";
import { getPrices } from "./market-data/get-prices";
import { SUPPORTED_CURRENCIES, SupportedCurrency } from "@/domain/currency";

type WalletPositionRow = Awaited<ReturnType<typeof QUERIES.getAllWalletsWithPositions>>[number];
type WalletSnapshotPosition = NonNullable<WalletPositionRow["position"]>;
type GroupedWalletSnapshotData = {
  currency: WalletPositionRow["wallet"]["currency"];
  cashBalance: number;
  totalContributed: number;
  totalWithdrawn: number;
  positions: WalletSnapshotPosition[];
};

export async function runSnapshot(type: "daily" | "intraday", operationId: string) {
  const { flat, netInvestedBalancesRaw, snapshotAt } = await db.transaction(async (tx) => {
    const snapshotAt = new Date();

    const flat = await tx
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
      .leftJoin(position, and(
        eq(wallet.id, position.walletId),
        gt(position.quantity, "0"),
        isNull(position.closedAt)
      ))
      .where(isNull(wallet.deletedAt));

    const netInvestedBalancesRaw = await tx
      .select({
        walletId: walletNetInvestedBalance.walletId,
        currency: walletNetInvestedBalance.currency,
        netInvested: walletNetInvestedBalance.netInvested,
      })
      .from(walletNetInvestedBalance)
      .innerJoin(wallet, eq(wallet.id, walletNetInvestedBalance.walletId))
      .where(isNull(wallet.deletedAt));

    return { flat, netInvestedBalancesRaw, snapshotAt };
  }, {
    isolationLevel: "repeatable read",
    accessMode: "read only",
  }).catch((error): never => {
    console.error("[cron/snapshot] Failed to load consistent wallet state", error);
    throw new Error("[cron/snapshot] DB_ERR: Failed to load consistent wallet state");
  });

  const grouped: Record<string, GroupedWalletSnapshotData> = {};

  for (const row of flat) {
    const { wallet, position } = row;

    if (!grouped[wallet.id]) {
      grouped[wallet.id] = {
        currency: wallet.currency,
        cashBalance: wallet.cashBalance,
        totalContributed: wallet.totalContributed,
        totalWithdrawn: wallet.totalWithdrawn,
        positions: [],
      };
    }

    if (position) {
      grouped[wallet.id].positions.push(position);
    }
  }

  const US_Symbols = new Set<string>();
  const WA_Symbols = new Set<string>();

  for (const wallet of Object.values(grouped)) {
    const symbols = wallet.currency === "USD" ? US_Symbols : WA_Symbols;

    for (const position of wallet.positions) {
      symbols.add(position.companySymbol);
    }
  }

  const walletCount = Object.keys(grouped).length;
  console.log(`[cron/snapshot] Starting ${type} run: ${walletCount} wallets, ${US_Symbols.size} US symbols, ${WA_Symbols.size} WA symbols`);

  const usResult = await getPrices({ symbols: [...US_Symbols], exchange: "US", mode: "snapshot", operationId });
  const waResult = await getPrices({ symbols: [...WA_Symbols], exchange: "WA", mode: "snapshot", operationId });

  if (usResult.isErr() && waResult.isErr()) {
    console.error("[cron/snapshot] Finnhub fetch failed", usResult.error.message);
    console.error("[cron/snapshot] Yahoo fetch failed", waResult.error.message);
    throw new Error("[cron/snapshot] Price fetch failed for Finnhub and Yahoo");
  }

  if (usResult.isErr()) {
    console.error("[cron/snapshot] Finnhub fetch failed", usResult.error.message);
    throw new Error(`[cron/snapshot] Finnhub price fetch failed: ${usResult.error.message}`);
  }

  if (waResult.isErr()) {
    console.error("[cron/snapshot] Yahoo fetch failed", waResult.error.message);
    throw new Error(`[cron/snapshot] Yahoo price fetch failed: ${waResult.error.message}`);
  }

  const usPriceData = usResult.value;
  const waPriceData = waResult.value;

  const allPrices = new Map([...usPriceData.prices, ...waPriceData.prices].map(p => [p.symbol, p.price]));
  const allFailures = [...usPriceData.failures, ...waPriceData.failures];
  const requestedSymbols = new Set([...US_Symbols, ...WA_Symbols]);

  if (allFailures.length > 0) {
    console.error(`[cron/snapshot] Price fetch failures: `, allFailures);
    throw new Error(
      `[cron/snapshot] Aborting ${type} run because some prices failed: ${allFailures
        .map((failure) => `${failure.symbol} (${failure.reason})`)
        .join(", ")}`
    );
  }

  const missingPrices = [...requestedSymbols].filter((symbol) => !allPrices.has(symbol));

  if (missingPrices.length > 0) {
    console.error(`[cron/snapshot] Missing prices: `, missingPrices);
    throw new Error(
      `[cron/snapshot] Aborting ${type} run because prices are missing: ${missingPrices.join(", ")}`
    );
  }

  const dailyRows = [];
  const intradayRows = [];

  // All rows share the timestamp captured when reading wallet state.
  const snapshotDate = snapshotAt.toISOString().split("T")[0];

  // get fxRate for USD->PLN
  const {rate, effectiveDate} = await getUsdPlnRate(snapshotAt);
  try {
    await db
      .insert(fxRates)
      .values({
        id: crypto.randomUUID(),
        baseCurrency: "USD",
        quoteCurrency: "PLN",
        rate: numToNumericString(rate),
        asOf: new Date(effectiveDate),
        granularity: "daily",
        source: "nbp"
      })
      .onConflictDoNothing();
  } catch (error) {
    console.error("[cron/snapshot] Error with inserting fx rates into the db:", error);
  }

  const netInvestedBalancesMap = new Map<string, Map<SupportedCurrency, string>>();

  for (const netInvested of netInvestedBalancesRaw) {
    let balancesByCurrency = netInvestedBalancesMap.get(netInvested.walletId);    

    if (!balancesByCurrency) {
      balancesByCurrency = new Map<SupportedCurrency, string>();
      netInvestedBalancesMap.set(netInvested.walletId, balancesByCurrency);
    }

    balancesByCurrency.set(netInvested.currency, netInvested.netInvested)
  }

  for (const [walletId, data] of Object.entries(grouped)) {
    let holdingsValue = 0;

    for (const pos of data.positions) {
      const price = allPrices.get(pos.companySymbol);
      if (price === undefined) {
        throw new Error(`[cron/snapshot] Missing validated price for ${pos.companySymbol}`);
      }

      holdingsValue += pos.quantity * price;
    }


    const nativeTotalValue = holdingsValue + data.cashBalance;

    for (const currency of SUPPORTED_CURRENCIES) {
      let convertedTotalValue = nativeTotalValue;
      if (currency !== data.currency) {
        convertedTotalValue = currency === "USD" 
          ? (nativeTotalValue) / rate
          : (nativeTotalValue) * rate;
      }

      const netInvested = netInvestedBalancesMap.get(walletId)?.get(currency);
      if (netInvested === undefined) {
        throw new Error(`[cron/snapshot] Missing netInvested balance for walletId ${walletId}, currency ${currency}`);
      }

      if (type === "daily") {
        dailyRows.push({
          id: crypto.randomUUID(),
          walletId,
          currency: currency,
          totalValue: numToNumericString(convertedTotalValue),
          netInvested: netInvested,
          snapshotDate: snapshotDate,
        });
      } else {
        intradayRows.push({
          id: crypto.randomUUID(),
          walletId,
          currency: currency,
          totalValue: numToNumericString(convertedTotalValue),
          netInvested: netInvested,
          snapshotAt: snapshotAt,
        });
      }
    }
  };

  if (dailyRows.length > 0) {
    try {
      await db
        .insert(walletDailySnapshot)
        .values(dailyRows)
        .onConflictDoUpdate({
          target: [
            walletDailySnapshot.walletId,
            walletDailySnapshot.snapshotDate,
            walletDailySnapshot.currency,
          ],
          set: {
            totalValue: sql`excluded.total_value`,
            netInvested: sql`excluded.net_invested`,
          },
        });
    } catch (error) {
      console.error("[cron/snapshot] Failed to insert daily snapshots", error);
      throw new Error("[cron/snapshot] DB_ERR: Failed to insert daily snapshots");
    }
  }

  if (intradayRows.length > 0) {
    try {
      await db.insert(walletIntradaySnapshot).values(intradayRows);
    } catch (error) {
      console.error("[cron/snapshot] Failed to insert intraday snapshots", error);
      throw new Error("[cron/snapshot] DB_ERR: Failed to insert intraday snapshots");
    }
  }

  if (type === "daily") {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

    try {
      await db.delete(walletIntradaySnapshot).where(
        lte(walletIntradaySnapshot.snapshotAt, cutoff)
      );
    } catch (error) {
      console.error("[cron/snapshot] Failed to delete old intraday snapshots", error);
      throw new Error("[cron/snapshot] DB_ERR: Failed to delete old intraday snapshots");
    }
  }

  const inserted = type === "daily" ? dailyRows.length : intradayRows.length;

  const summary = {
    success: true,
    type,
    walletsTotal: walletCount,
    snapshotsInserted: inserted,
    priceFailures: allFailures,
  };

  console.log(`[cron/snapshot] Completed: ${inserted} snapshots inserted`);

  return summary;
}
