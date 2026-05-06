import { getSession } from "@/server/better-auth/session";
import { redirect } from "next/navigation";
import { QUERIES } from "@/server/db/queries";
import Dashboard from "./dashboard";
import { ChartDataPoint, SerializedError, TimeRange } from "@/server/actions/types";
import { getAllWalletsPortfolioData } from "@/server/actions/dashboard-actions";
import { Result } from "better-result";

interface DashboardProps {
  searchParams: Promise<{ range?: TimeRange }>;
}

export default async function DashboardPage({ searchParams }: DashboardProps) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const range = (await searchParams).range ?? "1D";

  const userWallets = await QUERIES.getWalletsWithTotalValue(session.user.id);

  const wallets = userWallets.map((w) => ({
    id: w.id,
    name: w.name,
    currency: w.currency,
    totalValue: Number(w.totalValue),
  }));


  const [displayCurrencyRaw] = await QUERIES.getUserDisplayCurrency(session.session.userId);

  if (!displayCurrencyRaw) {
    throw new Error("Display currency is not configured for this account.");
  }

  const displayCurrency = displayCurrencyRaw.displayCurrency;

  const chartPortfolioDataSerialized = await getAllWalletsPortfolioData(range, displayCurrency);
  const deserialized = Result.deserialize<ChartDataPoint[], SerializedError>(chartPortfolioDataSerialized);

  if (!deserialized || Result.isError(deserialized)) {
    const error = deserialized ? deserialized.error : {message: "Unknown error"};
    return <Dashboard wallets={wallets} range={range} chartError={error.message}/>;
  }

  return <Dashboard wallets={wallets} range={range} chartData={deserialized.value} />;
}
