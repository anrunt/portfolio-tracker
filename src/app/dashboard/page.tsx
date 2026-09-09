import { getSession } from "@/server/better-auth/session";
import { redirect } from "next/navigation";
import { QUERIES } from "@/server/db/queries";
import Dashboard from "./dashboard";
import { getAllWalletsPortfolioData } from "@/server/services/chart-data";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/app/get-query-clients";
import { getChartQueryKey, timeRangeSchema, type ChartResponse } from "@/lib/chart-query";

interface DashboardProps {
  searchParams: Promise<{ range?: string | string[] }>;
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const rangeParam = (await searchParams).range;
  const range = timeRangeSchema.catch("1D").parse(rangeParam);

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

  const chartResult = await getAllWalletsPortfolioData(range, displayCurrency);
  const queryClient = getQueryClient();

  if (chartResult.isOk()) {
    queryClient.setQueryData(
      getChartQueryKey(session.user.id, { kind: "portfolio", displayCurrency }, range),
      { points: chartResult.value } satisfies ChartResponse,
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <Dashboard
        userId={session.user.id}
        wallets={wallets}
        displayCurrency={displayCurrency}
      />
    </HydrationBoundary>
  );
}
