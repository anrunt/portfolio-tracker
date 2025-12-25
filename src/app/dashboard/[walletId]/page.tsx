import { getSession } from "@/server/better-auth/session";
import { QUERIES } from "@/server/db/queries";
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

  const wallet = await QUERIES.getWalletById(walletId, session.user.id);
  if (!wallet) {
    redirect("/dashboard");
  }

  return (
    <>
      <h1>Your wallet:</h1>
      <h1>{wallet.name} - {wallet.currency}</h1>
    </>
  )
}
