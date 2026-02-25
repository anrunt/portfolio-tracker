"use client";

import { usePortfolioStats } from "@/hooks/use-portfolio-stats";
import type { PositionData, PriceResultData } from "@/server/actions/types";
import Search from "./search";
import { TrendingUp, TrendingDown, PieChart, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";

interface WalletSidebarProps {
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

export default function WalletSidebar({
  wallet,
  positions,
  groupedPositions,
  symbols,
  exchange,
  initialPriceData,
}: WalletSidebarProps) {
  const {
    totalCostBasis,
    totalCurrentValue,
    totalPl,
    totalPlPercent,
    totalPositions,
    uniqueSymbols,
    hasAnyPrice,
    formatCurrency,
    formatPl,
    formatPlPercent,
  } = usePortfolioStats({
    positions,
    groupedPositions,
    symbols,
    exchange,
    currency: wallet.currency,
    initialPriceData,
  });

  return (
    <aside className="w-72 border-r border-border/50 bg-background p-6 flex flex-col">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors group"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span className="text-sm">Back to Wallets</span>
        </Link>
        <ModeToggle size="icon-sm" className="shrink-0" />
      </div>

      <div className="space-y-4 flex-1">
        {/* Total Value Card */}
        <div className="p-4 rounded-xl bg-card border border-border relative overflow-hidden">
          {hasAnyPrice && (
            <div
              className={`absolute top-0 left-0 right-0 h-[2px] ${
                totalPl >= 0 ? "bg-emerald-500" : "bg-red-500"
              }`}
            />
          )}

          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
            <TrendingUp className="w-3.5 h-3.5" />
            Total Value
          </div>

          <div className="text-2xl font-semibold tabular-nums text-card-foreground">
            {formatCurrency(totalCurrentValue)}
            <span className="text-sm text-muted-foreground ml-1">
              {wallet.currency}
            </span>
          </div>

          {hasAnyPrice && (
            <div className="mt-3 pt-3 border-t border-border/40 space-y-2">
              <div className="flex items-center justify-between">
                <div
                  className={`flex items-center gap-1 text-sm font-medium tabular-nums ${
                    totalPl >= 0
                      ? "text-[#00D492]"
                      : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {totalPl >= 0 ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  <span>{formatPl(totalPl)}</span>
                </div>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[11px] font-semibold tabular-nums ${
                    totalPl >= 0
                      ? "bg-[#00D492]/15 text-[#00D492]"
                      : "bg-red-500/15 text-red-500 dark:bg-red-400/15 dark:text-red-400"
                  }`}
                >
                  {formatPlPercent(totalPlPercent)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>Invested</span>
                <span className="tabular-nums">
                  {formatCurrency(totalCostBasis)} {wallet.currency}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Portfolio Card */}
        <div className="p-4 rounded-xl bg-card border border-border">
          <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
            <PieChart className="w-3.5 h-3.5" />
            Portfolio
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-lg font-medium tabular-nums text-card-foreground">
                {uniqueSymbols}
              </div>
              <div className="text-xs text-muted-foreground">Companies</div>
            </div>
            <div>
              <div className="text-lg font-medium tabular-nums text-card-foreground">
                {totalPositions}
              </div>
              <div className="text-xs text-muted-foreground">Positions</div>
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-2">
          <Search exchange={exchange} />
        </div>
      </div>
    </aside>
  );
}
