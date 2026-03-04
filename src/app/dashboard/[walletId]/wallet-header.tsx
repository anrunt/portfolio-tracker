"use client";

import { usePortfolioStats } from "@/hooks/use-portfolio-stats";
import type { PositionData, PriceResultData } from "@/server/actions/types";
import { ArrowLeft, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";

interface WalletHeaderProps {
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

export default function WalletHeader({
  wallet,
  positions,
  groupedPositions,
  symbols,
  exchange,
  initialPriceData,
}: WalletHeaderProps) {
  const {
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
    <header className="relative border-b border-border/50 bg-card/60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group"
          >
            <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
            <span className="font-(family-name:--font-jb-mono) text-[10px] tracking-[0.1em] uppercase">
              Back
            </span>
          </Link>

          <div className="h-4 w-px bg-border/60" />

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="font-(family-name:--font-jb-mono) text-[11px] font-bold tracking-[0.2em] uppercase text-primary">
              {wallet.name}
            </span>
          </div>

          <div className="h-4 w-px bg-border/60" />

          <div className="flex items-baseline gap-1.5">
            <span className="font-(family-name:--font-jb-mono) text-lg font-bold tabular-nums text-foreground tracking-tight">
              {formatCurrency(totalCurrentValue)}
            </span>
            <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground font-semibold">
              {wallet.currency}
            </span>
          </div>

          {hasAnyPrice && (
            <>
              <div className="flex items-center gap-1.5">
                {totalPl >= 0 ? (
                  <TrendingUp className="w-3 h-3 text-emerald-500" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-500" />
                )}
                <span
                  className={`font-(family-name:--font-jb-mono) text-[11px] font-semibold tabular-nums ${
                    totalPl >= 0
                      ? "text-emerald-500"
                      : "text-red-500 dark:text-red-400"
                  }`}
                >
                  {formatPl(totalPl)}
                </span>
                <span
                  className={`font-(family-name:--font-jb-mono) text-[10px] px-1.5 py-0.5 rounded tabular-nums font-semibold ${
                    totalPl >= 0
                      ? "bg-emerald-500/10 text-emerald-500"
                      : "bg-red-500/10 text-red-500 dark:bg-red-400/10 dark:text-red-400"
                  }`}
                >
                  {formatPlPercent(totalPlPercent)}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.15em]">
            {uniqueSymbols} COMPAN{uniqueSymbols !== 1 ? "IES" : "Y"} · {totalPositions} POSITION{totalPositions !== 1 ? "S" : ""}
          </span>
          <ModeToggle size="icon-sm" />
        </div>
      </div>
    </header>
  );
}
