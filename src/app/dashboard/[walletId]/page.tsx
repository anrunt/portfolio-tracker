import { JetBrains_Mono } from "next/font/google";
import { getSession } from "@/server/better-auth/session";
import { QUERIES } from "@/server/db/queries";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import type { TimeRange } from "@/server/actions/types";
import WalletChart from "./wallet-chart";
import WalletPageClient from "./wallet-page-client";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb-mono",
});

interface WalletPageProps {
  params: Promise<{ walletId: string }>;
  searchParams: Promise<{ range?: TimeRange }>;
}

export default async function WalletPage({ params, searchParams }: WalletPageProps) {
  const { walletId } = await params;
  const range = (await searchParams).range ?? "1D";

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const [wallet, positionsRaw] = await Promise.all([
    QUERIES.getWalletById(walletId, session.user.id),
    QUERIES.getWalletPositions(walletId, session.user.id),
  ]);
  if (!wallet) {
    redirect("/dashboard");
  }

  const positions = positionsRaw.map((pos) => ({
    ...pos,
    quantity: Number(pos.quantity),
    pricePerShare: Number(pos.pricePerShare),
  }));

  const groupedPositions: Record<string, typeof positions> = {};
  for (const pos of positions) {
    (groupedPositions[pos.companySymbol] ??= []).push(pos);
  }

  const positionsSymbols = Object.keys(groupedPositions);
  const exchange = wallet.currency === "USD" ? "US" : "WA";

  const walletProps = {
    wallet: {
      id: wallet.id,
      name: wallet.name,
      currency: wallet.currency,
      cashBalance: wallet.cashBalance,
      totalBuyCost: wallet.totalBuyCost,
      totalContributed: wallet.totalContributed,
      totalWithdrawn: wallet.totalWithdrawn,
      realizedPl: wallet.realizedPl,
    },
    positions,
    groupedPositions,
    symbols: positionsSymbols,
    exchange,
  };

  return (
    <div className={`${mono.variable} min-h-screen bg-background relative`}>
      <div
        className="fixed inset-0 opacity-[0.025] pointer-events-none dark:opacity-[0.04]"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground) / 0.3) 1px, transparent 1px),
                            linear-gradient(90deg, hsl(var(--foreground) / 0.3) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      <WalletPageClient
        {...walletProps}
        chart={
          <Suspense
            key={`${wallet.id}:${range}`}
            fallback={
              <div role="status">
                <span className="sr-only">Loading performance chart</span>
                <div className="border-b border-border px-5 py-2.5">
                  <div className="h-6 w-40 animate-pulse rounded bg-muted" />
                </div>
                <div className="px-5 py-4">
                  <div className="aspect-5/1 w-full animate-pulse rounded bg-muted" />
                </div>
              </div>
            }
          >
            <WalletChart walletId={wallet.id} range={range} />
          </Suspense>
        }
      />
    </div>
  );
}
