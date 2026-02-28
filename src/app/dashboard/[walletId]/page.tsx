import { getSession } from "@/server/better-auth/session";
import { QUERIES } from "@/server/db/queries";
import { redirect } from "next/navigation";
import { getPrice } from "@/server/actions/dashboard-actions";
import type { PriceResultData } from "@/server/actions/types";
import { Result } from "better-result";
import type { SerializedError } from "@/server/actions/types";
import WalletPositions from "./wallet-positions";
import WalletSidebar from "./wallet-sidebar";
import WalletChart from "./wallet-chart";

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

  const groupedPositions: Record<string, typeof positions> = {};
  for (const pos of positions) {
    (groupedPositions[pos.companySymbol] ??= []).push(pos);
  }

  const positionsSymbols = Object.keys(groupedPositions);
  const exchange = wallet.currency === "USD" ? "US" : "WA";

  const serializedPrices = await getPrice(positionsSymbols, exchange);
  const deserializedPrices = Result.deserialize<PriceResultData, SerializedError>(serializedPrices);

  const initialPriceData: PriceResultData =
    deserializedPrices && Result.isOk(deserializedPrices)
      ? deserializedPrices.value
      : { prices: [], failures: [] };

  const walletProps = {
    wallet: { id: wallet.id, name: wallet.name, currency: wallet.currency },
    positions,
    groupedPositions,
    symbols: positionsSymbols,
    exchange,
    initialPriceData,
  };

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <WalletSidebar {...walletProps} />
      <div className="flex flex-1 flex-col">
        <div className="px-8 pt-8">
          <div className="max-w-6xl mx-auto">
            <WalletChart walletId={wallet.id} range={"1W"} />
          </div>
        </div>
        <WalletPositions {...walletProps} />
      </div>
    </div>
  );
}
