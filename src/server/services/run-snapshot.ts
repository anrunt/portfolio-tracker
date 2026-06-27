import { QUERIES } from "../db/queries";
import { getPriceData } from "./snapshot";
import { db } from "../db";
import { numToNumericString } from "../db/numeric";
import { fxRates, walletDailySnapshot, walletIntradaySnapshot } from "../db/schema";
import { lte, sql } from "drizzle-orm";
import { PriceResultData } from "../actions/types";
import { getUsdPlnRate } from "./getUsdPlnRate";

type WalletPositionRow = Awaited<ReturnType<typeof QUERIES.getAllWalletsWithPositions>>[number];
type WalletSnapshotPosition = NonNullable<WalletPositionRow["position"]>;
type GroupedWalletSnapshotData = {
  currency: WalletPositionRow["wallet"]["currency"];
  cashBalance: number;
  totalContributed: number;
  totalWithdrawn: number;
  positions: WalletSnapshotPosition[];
};

export async function runSnapshot(type: "daily" | "intraday") {
  const flat = await QUERIES.getAllWalletsWithPositions().catch((error): never => {
    console.error("[cron/snapshot] Failed to load wallets with positions", error);
    throw new Error("[cron/snapshot] DB_ERR: Failed to load wallets with positions");
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

  const [usResult, waResult] = await Promise.allSettled([
    getPriceData([...US_Symbols], "US"),
    getPriceData([...WA_Symbols], "WA"),
  ]);

  if (usResult.status === "rejected" && waResult.status === "rejected") {
    console.error("[cron/snapshot] Finnhub fetch failed", usResult.reason);
    console.error("[cron/snapshot] Stooq fetch failed", waResult.reason);
    throw new Error("[cron/snapshot] Price fetch failed for Finnhub and Stooq");
  }

  if (usResult.status === "rejected") {
    console.error("[cron/snapshot] Finnhub fetch failed", usResult.reason);
    throw new Error(`[cron/snapshot] Finnhub price fetch failed: ${toErrorMessage(usResult.reason)}`);
  }

  if (waResult.status === "rejected") {
    console.error("[cron/snapshot] Stooq fetch failed", waResult.reason);
    throw new Error(`[cron/snapshot] Stooq price fetch failed: ${toErrorMessage(waResult.reason)}`);
  }

  const usPriceData: PriceResultData = usResult.value;
  const waPriceData: PriceResultData = waResult.value;

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

  // This is to make sql aggregation work when we query portfolio data for all wallets - the date will be exactly the same in each snapshot
  const snapshotAt = new Date();
  const snapshotDate = new Date().toISOString().split("T")[0];

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

  for (const [walletId, data] of Object.entries(grouped)) {
    let holdingsValue = 0;

    for (const pos of data.positions) {
      const price = allPrices.get(pos.companySymbol);
      if (price === undefined) {
        throw new Error(`[cron/snapshot] Missing validated price for ${pos.companySymbol}`);
      }

      holdingsValue += pos.quantity * price;
    }

    const totalValue = holdingsValue + data.cashBalance;
    const netInvested = data.totalContributed - data.totalWithdrawn;

    if (type === "daily") {
      dailyRows.push({
        id: crypto.randomUUID(),
        walletId,
        totalValue: numToNumericString(totalValue),
        netInvested: numToNumericString(netInvested),
        snapshotDate: snapshotDate,
      });
    } else {
      intradayRows.push({
        id: crypto.randomUUID(),
        walletId,
        totalValue: numToNumericString(totalValue),
        netInvested: numToNumericString(netInvested),
        snapshotAt: snapshotAt,
      });
    }
  };

  if (dailyRows.length > 0) {
    try {
      await db
        .insert(walletDailySnapshot)
        .values(dailyRows)
        .onConflictDoUpdate({
          target: [walletDailySnapshot.walletId, walletDailySnapshot.snapshotDate],
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
  const skipped = walletCount - inserted;

  const summary = {
    success: true,
    type,
    walletsTotal: walletCount,
    snapshotsInserted: inserted,
    walletsSkipped: skipped,
    priceFailures: allFailures,
  };

  console.log(`[cron/snapshot] Completed: ${inserted} snapshots inserted, ${skipped} wallets skipped`);

  return summary;
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
