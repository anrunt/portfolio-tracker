import { PriceResultData, SerializedError } from "@/server/actions/types";
import { db } from "@/server/db";
import { QUERIES } from "@/server/db/queries";
import { walletDailySnapshot, walletIntradaySnapshot } from "@/server/db/schema";
import { getPriceInternal } from "@/server/services/snapshot";
import { Result, SerializedResult } from "better-result";
import { lte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const token = request.headers.get("Authorization")?.replace("Bearer ", "");
  const secret = process.env.CRON_JOB_SECRET;

  if (!secret || token !== secret) {
    return NextResponse.json({ error: "Not Authorized" }, { status: 401 });
  }

  const type = request.nextUrl.searchParams.get("type");

  if (type !== "daily" && type !== "intraday") {
    return NextResponse.json({error: "Invalid param: must be 'daily' or 'intraday'"}, {status: 400});
  }

  const flat = await QUERIES.getAllWalletsWithPositions();

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

  const usPriceData = toPriceData(await getPriceInternal([...US_Symbols], "US"), "US");
  const waPriceData = toPriceData(await getPriceInternal([...WA_Symbols], "WA"), "WA");

  const allPrices = new Map([...usPriceData.prices, ...waPriceData.prices].map(p => [p.symbol, p.price]));
  const allFailures = [...usPriceData.failures, ...waPriceData.failures];

  if (allFailures.length > 0) {
    console.warn(`[cron/snapshot] Price fetch failures: `, allFailures);
  }

  const dailyRows = [];
  const intradayRows = [];

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
      dailyRows.push({ id: crypto.randomUUID(), walletId, totalValue, totalCostBasis, snapshotDate: new Date().toISOString().split("T")[0] });
    } else {
      intradayRows.push({ id: crypto.randomUUID(), walletId, totalValue, totalCostBasis, snapshotAt: new Date() });
    }
  };

  if (dailyRows.length > 0) {
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
  }
  
  if (intradayRows.length > 0) {
    await db.insert(walletIntradaySnapshot).values(intradayRows);
  }

  if (type === "daily") {
    const cutoff = new Date(Date.now() - 48 * 60 * 60 * 1000);

    await db.delete(walletIntradaySnapshot).where(
      lte(walletIntradaySnapshot.snapshotAt, cutoff)
    );
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

  return NextResponse.json(summary);
}


function toPriceData(
  serialized: SerializedResult<PriceResultData, SerializedError>,
  label: string
): PriceResultData {
  const deserialized = Result.deserialize<PriceResultData, SerializedError>(serialized);
  if (deserialized && Result.isOk(deserialized)) {
    return deserialized.value;
  }
  if (deserialized && Result.isError(deserialized)) {
    console.error(`[cron/snapshot] ${label} price fetch error:`, deserialized.error);
  } else {
    console.error(`[cron/snapshot] ${label} price deserialize failed:`, serialized);
  }
  return { prices: [], failures: [] };
}