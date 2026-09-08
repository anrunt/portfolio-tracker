"use client";

import type { ReactNode } from "react";
import type { SupportedCurrency } from "@/domain/currency";
import { CircleHelp, TrendingDown, TrendingUp } from "lucide-react";
import { usePortfolioStats } from "@/hooks/use-portfolio-stats";
import type { PositionData, PriceResultData, WalletMetrics } from "@/server/actions/types";
import WalletHeader from "./wallet-header";
import WalletPositions from "./wallet-positions";
import WithdrawCashDialog from "./withdraw-cash-dialog";

interface WalletPageClientProps {
  wallet: {
    id: string;
    name: string;
    currency: SupportedCurrency;
  } & WalletMetrics;
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
    wallet,
    positions,
    groupedPositions,
    symbols,
    exchange,
    currency: wallet.currency,
    initialPriceData,
  });

  const {
    portfolioValue,
    netInvested,
    totalPl,
    totalPlPercent,
    realizedPl,
    unrealizedPl,
    formatCurrency,
    formatPl,
    formatPlPercent,
  } = portfolioStats;

  const plTextClass = (value: number) =>
    value > 0
      ? "text-emerald-500"
      : value < 0
        ? "text-red-500 dark:text-red-400"
        : "text-muted-foreground";

  const plBadgeClass = (value: number) =>
    value > 0
      ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
      : value < 0
        ? "bg-red-500/10 text-red-500 border-red-500/20 dark:bg-red-400/10 dark:text-red-400 dark:border-red-400/20"
        : "bg-muted/40 text-muted-foreground border-border/60";

  const metricCardClass = "rounded-lg border border-border/60 bg-card/70 dark:bg-card/40 px-3 py-3 min-w-0";

  return (
    <>
      <WalletHeader wallet={wallet} stats={portfolioStats} />

      <main className="relative max-w-7xl mx-auto px-6 py-8 space-y-6">
        <section className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <div className={metricCardClass}>
            <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Portfolio Value
            </p>
            <div className="flex items-baseline gap-1.5 mt-1 min-w-0">
              <span className="font-(family-name:--font-jb-mono) text-base font-bold tabular-nums text-foreground tracking-tight truncate">
                {formatCurrency(portfolioValue)}
              </span>
              <span className="font-(family-name:--font-jb-mono) text-[9px] text-muted-foreground font-semibold shrink-0">
                {wallet.currency}
              </span>
            </div>
          </div>

          <div className={metricCardClass}>
            <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Net Invested
            </p>
            <div className="flex items-baseline gap-1.5 mt-1 min-w-0">
              <span className="font-(family-name:--font-jb-mono) text-base font-semibold tabular-nums text-foreground tracking-tight truncate">
                {formatCurrency(netInvested)}
              </span>
              <span className="font-(family-name:--font-jb-mono) text-[9px] text-muted-foreground font-semibold shrink-0">
                {wallet.currency}
              </span>
            </div>
          </div>

          <div className={metricCardClass}>
            <div className="flex items-center justify-between gap-2">
              <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Total P/L
              </p>
              {totalPl >= 0 ? (
                <TrendingUp className="size-3 text-emerald-500 shrink-0" />
              ) : (
                <TrendingDown className="size-3 text-red-500 shrink-0" />
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-1 min-w-0">
              <span className={`font-(family-name:--font-jb-mono) text-base font-semibold tabular-nums tracking-tight truncate ${plTextClass(totalPl)}`}>
                {formatPl(totalPl)}
              </span>
              <span className="font-(family-name:--font-jb-mono) text-[9px] text-muted-foreground font-semibold shrink-0">
                {wallet.currency}
              </span>
            </div>
            <span className={`inline-flex mt-1 font-(family-name:--font-jb-mono) text-[9px] px-1.5 py-0.5 rounded border tabular-nums font-semibold ${plBadgeClass(totalPl)}`}>
              {formatPlPercent(totalPlPercent)}
            </span>
          </div>

          <div className={metricCardClass}>
            <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Realized P/L
            </p>
            <div className="flex items-baseline gap-1.5 mt-1 min-w-0">
              <span className={`font-(family-name:--font-jb-mono) text-base font-semibold tabular-nums tracking-tight truncate ${plTextClass(realizedPl)}`}>
                {formatPl(realizedPl)}
              </span>
              <span className="font-(family-name:--font-jb-mono) text-[9px] text-muted-foreground font-semibold shrink-0">
                {wallet.currency}
              </span>
            </div>
          </div>

          <div className={metricCardClass}>
            <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
              Unrealized P/L
            </p>
            <div className="flex items-baseline gap-1.5 mt-1 min-w-0">
              <span className={`font-(family-name:--font-jb-mono) text-base font-semibold tabular-nums tracking-tight truncate ${plTextClass(unrealizedPl)}`}>
                {formatPl(unrealizedPl)}
              </span>
              <span className="font-(family-name:--font-jb-mono) text-[9px] text-muted-foreground font-semibold shrink-0">
                {wallet.currency}
              </span>
            </div>
          </div>

          <div className={metricCardClass}>
            <div className="flex items-center gap-1.5">
              <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Available Cash
              </p>
              <CircleHelp
                className="size-3 text-muted-foreground/60 shrink-0"
                aria-label="Internal cash help"
              >
                <title>
                  Internal cash is sale proceeds left in this wallet. Future buys use it before adding new contributions.
                </title>
              </CircleHelp>
            </div>
            <div className="flex items-baseline gap-1.5 mt-1 min-w-0">
              <span className="font-(family-name:--font-jb-mono) text-base font-semibold tabular-nums text-foreground tracking-tight truncate">
                {formatCurrency(wallet.cashBalance)}
              </span>
              <span className="font-(family-name:--font-jb-mono) text-[9px] text-muted-foreground font-semibold shrink-0">
                {wallet.currency}
              </span>
            </div>
            <div className="mt-2">
              <WithdrawCashDialog
                walletId={wallet.id}
                cashBalance={wallet.cashBalance}
                currency={wallet.currency}
              />
            </div>
          </div>
        </section>

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
