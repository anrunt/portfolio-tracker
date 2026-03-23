import { QUERIES } from "../db/queries";
import { getPriceData } from "./snapshot";
import { db } from "../db";
import { walletDailySnapshot, walletIntradaySnapshot } from "../db/schema";
import { lte, sql } from "drizzle-orm";
import { PriceResultData } from "../actions/types";

export async function runSnapshot(type: "daily" | "intraday") {
  let flat;

  try {
    flat = await QUERIES.getAllWalletsWithPositions();
  } catch (error) {
    console.error("[cron/snapshot] Failed to load wallets with positions", error);
    throw new Error("[cron/snapshot] DB_ERR: Failed to load wallets with positions");
  }

  const grouped = flat.reduce((acc, row) => {
    const {wallet, position} = row;

    if (!acc[wallet.id]) {
      acc[wallet.id] = {currency: wallet.currency, positions: []}
    }
    
    acc[wallet.id].positions.push(position);

    return acc;
  }, {} as Record<string, {currency: string, positions: typeof flat[number]["position"][]}>);

  const US_Symbols = new Set<string>();
  const WA_Symbols = new Set<string>();

  for (const wallet of Object.values(grouped)) {
    if (wallet.currency === "USD") {
      for (const positions of wallet.positions) {
        US_Symbols.add(positions.companySymbol);
      }
    } else {
      for (const position of wallet.positions) {
        WA_Symbols.add(position.companySymbol);
      }
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

  if (allFailures.length > 0) {
    console.warn(`[cron/snapshot] Price fetch failures: `, allFailures);
  }

  const dailyRows = [];
  const intradayRows = [];

  // This is to make sql aggregation work when we query portfolio data for all wallets - the date will be exactly the same in each snapshot
  const snapshotAt = new Date();
  const snapshotDate = new Date().toISOString().split("T")[0];

  walletLoop: for (const [walletId, data] of Object.entries(grouped)) {
    let totalValue = 0;
    let totalCostBasis = 0;

    for (const pos of data.positions) {
      const price = allPrices.get(pos.companySymbol);
      if (price === undefined) {
        console.warn(`[cron/snapshot] Missing price for ${pos.companySymbol}, skipping wallet ${walletId}`);
        continue walletLoop;
      };
      totalValue += pos.quantity * price;
      totalCostBasis += pos.quantity * pos.pricePerShare;
    }
    
    if (type === "daily") {
      dailyRows.push({ id: crypto.randomUUID(), walletId, totalValue, totalCostBasis, snapshotDate: snapshotDate });
    } else {
      intradayRows.push({ id: crypto.randomUUID(), walletId, totalValue, totalCostBasis, snapshotAt: snapshotAt });
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
            totalCostBasis: sql`excluded.total_cost_basis`,
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