import { getSession } from "@/server/better-auth/session";
import { redirect } from "next/navigation";
import { QUERIES } from "@/server/db/queries";
import DashboardLayout from "./dashboard-v1";

export default async function Dashboard() {
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

  return <DashboardLayout wallets={wallets} />;
}
