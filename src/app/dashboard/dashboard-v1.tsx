"use client";

import { JetBrains_Mono } from "next/font/google";
import Wallet from "./wallet";
import AddWallet from "./add-wallet";
import { ModeToggle } from "@/components/mode-toggle";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb-mono",
});

interface Props {
  wallets: Array<{
    id: string;
    name: string;
    currency: string;
    totalValue: number;
  }>;
}

export default function DashboardV1({ wallets }: Props) {
  const totalsByCurrency: Record<string, number> = {};
  for (const w of wallets) {
    totalsByCurrency[w.currency] =
      (totalsByCurrency[w.currency] || 0) + w.totalValue;
  }

  const fmt = (val: number, currency: string) =>
    val.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

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

      <header className="relative border-b border-border/50 bg-card/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="font-(family-name:--font-jb-mono) text-[11px] font-bold tracking-[0.2em] uppercase text-primary">
                Portfolio Tracker
              </span>
            </div>
            <div className="h-4 w-px bg-border/60" />
            <div className="flex gap-5">
              {Object.entries(totalsByCurrency).map(([currency, total]) => (
                <div key={currency} className="flex items-baseline gap-1.5">
                  <span className="font-(family-name:--font-jb-mono) text-lg font-bold tabular-nums text-foreground tracking-tight">
                    {fmt(total, currency)}
                  </span>
                  <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground font-semibold">
                    {currency}
                  </span>
                </div>
              ))}
              {wallets.length === 0 && (
                <span className="font-(family-name:--font-jb-mono) text-xs text-muted-foreground">
                  --
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.15em]">
              {wallets.length} WALLET{wallets.length !== 1 ? "S" : ""} ACTIVE
            </span>
            <ModeToggle size="icon-sm" />
          </div>
        </div>
      </header>

      <main className="relative max-w-7xl mx-auto px-6 py-8 space-y-6">
        <section className="rounded-lg border border-border/50 bg-card/40 backdrop-blur-sm overflow-hidden">
          <div className="px-5 py-2.5 border-b border-border/30 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.2em] uppercase font-medium">
                Performance Overview
              </span>
            </div>
            <div className="flex gap-0.5">
              {["1D", "1W", "1M", "3M", "6M", "1Y"].map((r) => (
                <span
                  key={r}
                  className="px-2.5 py-1 font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground rounded hover:bg-muted/50 hover:text-foreground cursor-pointer transition-all"
                >
                  {r}
                </span>
              ))}
            </div>
          </div>
          <div className="h-[360px] flex items-center justify-center relative">
            <div
              className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03]"
              style={{
                backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, currentColor 3px, currentColor 4px)`,
              }}
            />
            <div className="text-center space-y-3 relative">
              <div className="w-14 h-14 mx-auto border border-dashed border-primary/20 rounded flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-primary/30"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
                  />
                </svg>
              </div>
              <p className="font-(family-name:--font-jb-mono) text-[11px] text-muted-foreground/30 tracking-wider">
                CHART_PLACEHOLDER
              </p>
            </div>
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
              <h2 className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.2em] uppercase font-medium">
                Wallets
              </h2>
            </div>
            <AddWallet />
          </div>

          {wallets.length === 0 ? (
            <div className="py-20 text-center border border-dashed border-border/40 rounded-lg">
              <p className="font-(family-name:--font-jb-mono) text-xs text-muted-foreground/40 tracking-wider">
                NO_WALLETS_FOUND
              </p>
              <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground/25 mt-1">
                Create your first wallet to begin tracking
              </p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {wallets.map((w) => (
                <Wallet key={w.id} wallet={w} />
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
