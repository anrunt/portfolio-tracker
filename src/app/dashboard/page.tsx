import { getSession } from "@/server/better-auth/session";
import { redirect } from "next/navigation";
import { QUERIES } from "@/server/db/queries";
import AddWallet from "./add-wallet";
import Link from "next/link";

export default async function Dashboard() {
  const session = await getSession()

  if (!session) {
    redirect("/login");
  }

  const userWallets = await QUERIES.getWallets(session.user.id);
  console.log("User wallets: ", userWallets);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-md">
        <h1 className="text-xl font-medium mb-8">
          Your Wallets
        </h1>

        <div className="flex flex-col items-center gap-3">
          {userWallets.length === 0 ? (
            <p className="text-muted-foreground">
              No wallets yet
            </p>
          ) : (
            userWallets.map(w => (
              <Link
                href={`/dashboard/${w.id}`}
                key={w.id}
                className="w-full px-4 py-3 border border-gray-700 rounded-md hover:bg-secondary transition-colors flex items-center justify-between"
              >
                <span>{w.name}</span>
                <span className="text-muted-foreground">1000 {w.currency}</span>
              </Link>
            ))
          )}

          <div className="mt-6">
            <AddWallet />
          </div>
        </div>
      </div>
    </div>
  );
}
