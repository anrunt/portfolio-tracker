import type { SupportedCurrency } from "@/domain/currency";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import type { DbTransaction } from "../db";
import { fxRates, walletNetInvestedBalance } from "../db/schema";
import { NotFoundError, ValidationError } from "../errors";

export async function getWalletNetInvestedFxRate(
  tx: DbTransaction,
  lookup: { date: Date } | { id: string },
) {
  const fxRate = await tx
    .select({
      id: fxRates.id,
      rate: sql<number>`(${fxRates.rate})::double precision`,
    })
    .from(fxRates)
    .where(
      and(
        eq(fxRates.baseCurrency, "USD"),
        eq(fxRates.quoteCurrency, "PLN"),
        eq(fxRates.granularity, "daily"),
        eq(fxRates.source, "nbp"),
        "id" in lookup
          ? eq(fxRates.id, lookup.id)
          : lte(fxRates.asOf, lookup.date),
      ),
    )
    .orderBy(desc(fxRates.asOf))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!fxRate) {
    throw new NotFoundError({ resource: "No fx rate for netInvested" });
  }
  if (!Number.isFinite(fxRate.rate) || fxRate.rate <= 0) {
    throw new ValidationError({ message: "Invalid USD/PLN rate for netInvested" });
  }

  return fxRate;
}

export async function applyWalletNetInvestedChange(
  tx: DbTransaction,
  walletId: string,
  walletCurrency: SupportedCurrency,
  amount: number,
  direction: "increase" | "decrease",
  usdPlnRate: number,
) {
  const signedAmount = direction === "increase" ? amount : -amount;

  const deltas = new Map<SupportedCurrency, number>();

  if (walletCurrency === "USD") {
    deltas.set("USD", signedAmount);
    deltas.set("PLN", signedAmount * usdPlnRate);
  } else if (walletCurrency === "PLN") {
    deltas.set("PLN", signedAmount);
    deltas.set("USD", signedAmount / usdPlnRate);
  }

  for (const [currency, delta] of deltas) {
    await tx
      .update(walletNetInvestedBalance)
      .set({
        netInvested: sql`${walletNetInvestedBalance.netInvested} + ${delta}`
      })
      .where(
        and(
          eq(walletNetInvestedBalance.walletId, walletId),
          eq(walletNetInvestedBalance.currency, currency)
        )
      );
  }
}
