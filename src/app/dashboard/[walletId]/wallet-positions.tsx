"use client";

import { usePrices } from "@/hooks/use-prices";
import type { PriceResultData } from "@/server/actions/types";
import Search from "./search";
import MainPosition from "./position-main";
import { TrendingUp, TrendingDown, PieChart, ArrowLeft, Wallet } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PositionData {
  id: string;
  companySymbol: string;
  companyName: string;
  quantity: number;
  pricePerShare: number;
  createdAt: Date;
}

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
  const { pricesBySymbol, failedSymbols, dataUpdatedAt } = usePrices({
    symbols,
    exchange,
    initialData: initialPriceData,
  });

  const totalCostBasis = positions.reduce(
    (sum, pos) => sum + pos.pricePerShare * pos.quantity,
    0
  );
  const totalPositions = positions.length;
  const uniqueSymbols = Object.keys(groupedPositions).length;

  let totalCurrentValue = 0;
  let hasAnyPrice = false;
  for (const pos of positions) {
    const livePrice = !failedSymbols.has(pos.companySymbol)
      ? pricesBySymbol.get(pos.companySymbol)
      : undefined;
    if (typeof livePrice === "number") {
      totalCurrentValue += livePrice * pos.quantity;
      hasAnyPrice = true;
    } else {
      totalCurrentValue += pos.pricePerShare * pos.quantity;
    }
  }
  const totalPl = totalCurrentValue - totalCostBasis;
  const totalPlPercent =
    totalCostBasis > 0 ? (totalPl / totalCostBasis) * 100 : 0;

  // --- Formatters ---
  const formatCurrency = (value: number) =>
    value.toLocaleString(wallet.currency === "USD" ? "en-US" : "pl-PL", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

  const formatPl = (value: number) => {
    const sign = value > 0 ? "+" : value < 0 ? "\u2212" : "";
    return sign + formatCurrency(Math.abs(value));
  };

  const formatPlPercent = (value: number) => {
    const sign = value > 0 ? "+" : value < 0 ? "\u2212" : "";
    return sign + Math.abs(value).toFixed(2) + "%";
  };

  const gridLayoutClass =
    "grid grid-cols-[65px_1.5fr_65px_110px_110px_110px_150px_44px] gap-3 items-center";

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Sidebar */}
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

      {/* Main Content */}
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
    </div>
  );
}
