"use client";

import type { PortfolioStats } from "@/hooks/use-portfolio-stats";
import { ArrowLeft, CircleHelp, TrendingUp, TrendingDown } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";
import WithdrawCashDialog from "./withdraw-cash-dialog";

interface WalletHeaderProps {
  wallet: {
    id: string;
    name: string;
    currency: string;
    cashBalance: number;
  };
  stats: PortfolioStats;
}

export default function WalletHeader({
  wallet,
  stats,
}: WalletHeaderProps) {
  const {
    portfolioValue,
    netInvested,
    totalPl,
    totalPlPercent,
    realizedPl,
    unrealizedPl,
    totalPositions,
    uniqueSymbols,
    formatCurrency,
    formatPl,
    formatPlPercent,
  } = stats;

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

  return (
    <header className="relative border-b border-border/50 bg-card/60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 py-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-4 min-w-0">
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group shrink-0"
            >
              <ArrowLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
              <span className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase">
                Back
              </span>
            </Link>

            <div className="h-4 w-px bg-border/60 shrink-0" />

            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse shrink-0" />
              <span className="font-(family-name:--font-jb-mono) text-[11px] font-bold tracking-[0.2em] uppercase text-primary truncate">
                {wallet.name}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.15em]">
              {uniqueSymbols} COMPAN{uniqueSymbols !== 1 ? "IES" : "Y"} · {totalPositions} POSITION{totalPositions !== 1 ? "S" : ""}
            </span>
            <ModeToggle size="icon-sm" />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-2.5">
          <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-3 min-w-0">
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

          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 min-w-0">
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

          <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-3 min-w-0">
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

          <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-3 min-w-0">
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

          <div className="rounded-lg border border-border/60 bg-card/40 px-3 py-3 min-w-0">
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

          <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-3 min-w-0">
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
        </div>
      </div>
    </header>
  );
}
