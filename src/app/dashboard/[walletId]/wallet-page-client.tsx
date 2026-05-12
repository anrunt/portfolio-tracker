"use client";

import type { ReactNode } from "react";
import { usePortfolioStats } from "@/hooks/use-portfolio-stats";
import type { PositionData, PriceResultData } from "@/server/actions/types";
import WalletHeader from "./wallet-header";
import WalletPositions from "./wallet-positions";

interface WalletPageClientProps {
  wallet: {
    id: string;
    name: string;
    currency: string;
  };
  positions: PositionData[];
  groupedPositions: Record<string, PositionData[]>;
  symbols: string[];
  exchange: string;
  initialPriceData: PriceResultData;
  chart: ReactNode;
}

export default function WalletPageClient({
  wallet,
  positions,
  groupedPositions,
  symbols,
  exchange,
  initialPriceData,
  chart,
}: WalletPageClientProps) {
  const portfolioStats = usePortfolioStats({
    positions,
    groupedPositions,
    symbols,
    exchange,
    currency: wallet.currency,
    initialPriceData,
  });

  return (
    <>
      <WalletHeader wallet={wallet} stats={portfolioStats} />

      <main className="relative max-w-7xl mx-auto px-6 py-8 space-y-6">
        <section className="rounded-lg border border-border bg-card/40 backdrop-blur-sm overflow-hidden">
          {chart}
        </section>

        <WalletPositions
          wallet={wallet}
          positions={positions}
          groupedPositions={groupedPositions}
          exchange={exchange}
          pricesBySymbol={portfolioStats.pricesBySymbol}
          failedSymbols={portfolioStats.failedSymbols}
          lastUpdated={portfolioStats.lastUpdated}
        />
      </main>
    </>
  );
}
