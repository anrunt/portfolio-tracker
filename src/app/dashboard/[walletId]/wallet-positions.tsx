"use client";

import { usePortfolioStats } from "@/hooks/use-portfolio-stats";
import type { PositionData, PriceResultData } from "@/server/actions/types";
import MainPosition from "./position-main";
import { ScrollArea } from "@/components/ui/scroll-area";
import Search from "./search";

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
    <section>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          <h2 className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.2em] uppercase font-medium">
            Positions
          </h2>
        </div>
        <Search exchange={exchange} />
      </div>

      <div className="rounded-lg border border-border bg-card/40 backdrop-blur-sm overflow-hidden">
        {/* Header */}
        <div className="hidden md:block border-b border-border px-3">
          <div
            className={`${gridLayoutClass} px-4 py-3 font-(family-name:--font-jb-mono) text-[10px] uppercase tracking-[0.15em] text-muted-foreground font-medium`}
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
          <div className="p-3">
            {positions.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-border/70 rounded-lg">
                <p className="font-(family-name:--font-jb-mono) text-xs text-muted-foreground/70 tracking-wider">
                  NO_POSITIONS_FOUND
                </p>
                <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground/50 mt-1">
                  Add your first position to begin tracking
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
        <div className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground/40 text-right pt-2 pr-1 tracking-wider">
          LAST_UPDATE: {lastUpdated}
        </div>
      )}
    </section>
  );
}
