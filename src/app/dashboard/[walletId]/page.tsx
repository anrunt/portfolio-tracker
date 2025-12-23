import { getSession } from "@/server/better-auth/session";
import { redirect } from "next/navigation";

export default async function WalletPage({
  params,
}: {
  params: Promise<{ walletId: string }>;
}) {
  const { walletId } = await params;

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  return <h1>Wallet</h1>;
}
