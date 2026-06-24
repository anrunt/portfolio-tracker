"use client";

import type { PortfolioStats } from "@/hooks/use-portfolio-stats";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";

interface WalletHeaderProps {
  wallet: {
    id: string;
    name: string;
    currency: string;
  };
  stats: PortfolioStats;
}

export default function WalletHeader({
  wallet,
  stats,
}: WalletHeaderProps) {
  const { totalPositions, uniqueSymbols } = stats;

  return (
    <header className="relative border-b border-border/50 bg-card/60 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
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

        <div className="flex items-center gap-4 shrink-0">
          <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.15em]">
            {uniqueSymbols} COMPAN{uniqueSymbols !== 1 ? "IES" : "Y"} · {totalPositions} POSITION{totalPositions !== 1 ? "S" : ""}
          </span>
          <ModeToggle size="icon-sm" />
        </div>
      </div>
    </header>
  );
}
