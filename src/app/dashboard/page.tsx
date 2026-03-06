import { getSession } from "@/server/better-auth/session";
import { redirect } from "next/navigation";
import { QUERIES } from "@/server/db/queries";
import Dashboard from "./dashboard";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const userWallets = await QUERIES.getWalletsWithTotalValue(session.user.id);

  const wallets = userWallets.map((w) => ({
    id: w.id,
    name: w.name,
    currency: w.currency,
    totalValue: w.totalValue,
  }));

  return <Dashboard wallets={wallets} />;
}
