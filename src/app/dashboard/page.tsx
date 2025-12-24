import { getSession } from "@/server/better-auth/session";
import { redirect } from "next/navigation";
import { QUERIES } from "@/server/db/queries";
import AddWallet from "./add-wallet";

export default async function Dashboard() {
  const session = await getSession()

  if (!session) {
    redirect("/login");
  }

  const userWallets = await QUERIES.getWallets(session.user.id);
  console.log("User wallets: ", userWallets);

  return (
    <div>
      <h1>Welcome {session.user.name}</h1>
      {userWallets.length === 0 ? (
        <p>No wallets</p>
      ) : (
        userWallets.map(w => (
          <div key={w.id}>{w.name}, {w.currency}</div>
        ))
      )}

      <AddWallet />
    </div>
  );
}
