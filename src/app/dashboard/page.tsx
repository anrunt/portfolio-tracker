import { getSession } from "@/server/better-auth/session";
import { redirect } from "next/navigation";
import { QUERIES } from "@/server/db/queries";
import Dashboard from "./dashboard";
import { TimeRange } from "@/server/actions/types";
import { getAllWalletsPortfolioData } from "@/server/services/chart-data";

interface DashboardProps {
  searchParams: Promise<{ range?: TimeRange }>;
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const range = (await searchParams).range ?? "1D";

  const userWallets = await QUERIES.getWalletsWithLatestSnapshot(session.user.id);

  const wallets = userWallets.map((w) => {
    if (w.totalValue === null || w.netInvested === null) {
      throw new Error(`No native valuation for ${w.name}`);
    }
    return {
      id: w.id,
      name: w.name,
      currency: w.currency,
      totalValue: w.totalValue,
      netInvested: w.netInvested,
      snapshotAt: w.snapshotAt,
    }
  });


  const displayCurrencyRaw = await QUERIES.getUserDisplayCurrency(session.session.userId);

  if (!displayCurrencyRaw) {
    throw new Error("Display currency is not configured for this account.");
  }

  const displayCurrency = displayCurrencyRaw.displayCurrency;

  const chartResult = await getAllWalletsPortfolioData(range);

  if (chartResult.isErr()) {
    return (
      <Dashboard
        wallets={wallets}
        range={range}
        displayCurrency={displayCurrency}
        chartError={chartResult.error.message}
      />
    );
  }

  return (
    <Dashboard
      wallets={wallets}
      range={range}
      displayCurrency={displayCurrency}
      chartData={chartResult.value}
    />
  );
}
