import { SupportedCurrency } from "@/domain/currency";
import { and, desc, eq, lte, sql } from "drizzle-orm";
import type { DbTransaction } from "../db";
import { fxRates, walletNetInvestedBalance } from "../db/schema";
import { NotFoundError } from "../errors";

export async function applyWalletNetInvestedChange(
  tx: DbTransaction,
  walletId: string,
  walletCurrency: SupportedCurrency,
  amount: number,
  direction: "increase" | "decrease",
  transactionDate: Date 
) {
  const fxRate = await tx
    .select({
      rate: sql<number>`(${fxRates.rate})::double precision`,
    })
    .from(fxRates)
    .where(
      and(
        eq(fxRates.baseCurrency, "USD"),
        eq(fxRates.quoteCurrency, "PLN"),
        eq(fxRates.granularity, "daily"),
        eq(fxRates.source, "nbp"),
        lte(fxRates.asOf, transactionDate),
      ),
    )
    .orderBy(desc(fxRates.asOf))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!fxRate) {
    throw new NotFoundError({ resource: "No fx rate for netInvested" });
  }
  if (fxRate.rate <= 0) {
    throw new NotFoundError({ resource: "fxRate below or equal 0 for netInvested"})
  }

  const signedAmount = direction === "increase" ? amount : -amount;

  const deltas = new Map<SupportedCurrency, number>();

  if (walletCurrency === "USD") {
    deltas.set("USD", signedAmount);
    deltas.set("PLN", signedAmount * fxRate.rate);
  } else if (walletCurrency === "PLN") {
    deltas.set("PLN", signedAmount);
    deltas.set("USD", signedAmount / fxRate.rate);
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
      )
  }
}
