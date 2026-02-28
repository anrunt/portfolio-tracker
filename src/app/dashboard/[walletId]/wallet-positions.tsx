"use client";

import { usePortfolioStats } from "@/hooks/use-portfolio-stats";
import type { PositionData, PriceResultData } from "@/server/actions/types";
import MainPosition from "./position-main";
import { Wallet } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

interface WalletPositionsProps {
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
}

export default function WalletPositions({
  wallet,
  positions,
  groupedPositions,
  symbols,
  exchange,
  initialPriceData,
}: WalletPositionsProps) {
  const { pricesBySymbol, failedSymbols, lastUpdated } = usePortfolioStats({
    positions,
    groupedPositions,
    symbols,
    exchange,
    currency: wallet.currency,
    initialPriceData,
  });

  const gridLayoutClass =
    "grid grid-cols-[65px_1.5fr_65px_110px_110px_110px_150px_44px] gap-3 items-center";

  return (
    <main className="flex-1 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h2 className="text-3xl font-semibold tracking-tight mb-2 text-muted-foreground">
            Positions
          </h2>
          <p className="text-muted-foreground">
            Manage your portfolio holdings
          </p>
        </div>

        {/* Positions Container */}
        <div className="rounded-2xl border border-border/60 bg-linear-to-b from-card/50 to-card/30 backdrop-blur-sm shadow-lg shadow-black/5 overflow-hidden">
          {/* Header */}
          <div className="hidden md:block border-b border-border/40 bg-muted/30 px-4 py-4">
            <div
              className={`${gridLayoutClass} px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium`}
            >
              <div>Symbol</div>
              <div>Name</div>
              <div className="text-right">Qty</div>
              <div className="text-right">Total</div>
              <div className="text-right">Avg Price</div>
              <div className="text-right">Current</div>
              <div className="text-right">P/L</div>
              <div></div>
            </div>
          </div>

          {/* Scrollable Positions Area */}
          <ScrollArea className="h-[40vh]">
            <div className="p-4">
              {positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[calc(40vh-2rem)] text-muted-foreground">
                  <Wallet className="w-12 h-12 mb-4 opacity-30" />
                  <p className="font-light">No positions yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">
                    Add your first position to get started
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-0">
                  {Object.entries(groupedPositions).map(
                    ([symbol, symbolPositions]) => (
                      <MainPosition
                        key={symbol}
                        companySymbol={symbol}
                        positions={symbolPositions!}
                        walletId={wallet.id}
                        currency={wallet.currency}
                        currentPrice={
                          failedSymbols.has(symbol)
                            ? undefined
                            : pricesBySymbol.get(symbol)
                        }
                        gridLayoutClass={gridLayoutClass}
                      />
                    )
                  )}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Last Updated indicator */}
        {lastUpdated && (
          <div className="text-[11px] text-muted-foreground/60 text-right pt-2 pr-1">
            Prices updated at {lastUpdated}
          </div>
        )}
      </div>
    </main>
  );
}
