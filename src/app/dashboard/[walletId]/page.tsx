import { getSession } from "@/server/better-auth/session";
import { QUERIES } from "@/server/db/queries";
import { redirect } from "next/navigation";
import Search from "./search";
import Position from "./position";

interface WalletPageProps {
  params: Promise<{ walletId: string }>;
}

export default async function WalletPage({ params }: WalletPageProps) {
  const { walletId } = await params;

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const wallet = await QUERIES.getWalletById(walletId, session.user.id);
  if (!wallet) {
    redirect("/dashboard");
  }

  const positions = await QUERIES.getWalletPositions(walletId, session.user.id);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-3xl">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-medium mb-1">{wallet.name}</h1>
          <p className="text-muted-foreground uppercase">{wallet.currency}</p>
        </div>

        <div className="flex flex-col gap-3">
          {positions.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No positions yet
            </p>
          ) : (
            positions.map((pos) => (
              <Position
                key={pos.id}
                walletId={wallet.id}
                positionId={pos.id}
                companySymbol={pos.companySymbol}
                companyName={pos.companyName}
                quantity={pos.quantity}
                pricePerShare={pos.pricePerShare}
                currency={wallet.currency}
              />
            ))
          )}

          <div className="mt-6 flex justify-center">
            <Search />
          </div>
        </div>
      </div>
    </div>
  );
}
