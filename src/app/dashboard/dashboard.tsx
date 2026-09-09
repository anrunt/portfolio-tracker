"use client";

import Link from "next/link";
import { JetBrains_Mono } from "next/font/google";
import Wallet from "./wallet";
import AddWallet from "./add-wallet";
import { ModeToggle } from "@/components/mode-toggle";
import {
  SUPPORTED_CURRENCIES,
  type SupportedCurrency,
} from "@/domain/currency";
import PerformanceChartClient from "./performance-chart-client";
import DisplayCurrencyToggle from "./display-currency-toggle";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb-mono",
});

interface Props {
  wallets: Array<{
    id: string;
    name: string;
    currency: SupportedCurrency;
    totalValue: number;
    netInvested: number;
    snapshotAt: Date | null;
  }>;
  userId: string;
  displayCurrency: SupportedCurrency;
}

export default function Dashboard({ userId, wallets, displayCurrency }: Props) {
  const totalsByCurrency: Partial<Record<SupportedCurrency, number>> = {};
  for (const w of wallets) {
    totalsByCurrency[w.currency] =
      (totalsByCurrency[w.currency] || 0) + w.totalValue;
  }

  const fmt = (val: number, currency: SupportedCurrency) =>
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
            <Link
              href="/"
              className="flex items-center gap-2 rounded-sm focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <div className="w-2 h-2 rounded-full bg-primary" />
              <span className="font-(family-name:--font-jb-mono) text-[11px] font-bold tracking-[0.2em] uppercase text-primary">
                Portfolio Tracker
              </span>
            </Link>
            <div className="h-4 w-px bg-border/60" />
            <div className="flex gap-5">
              {SUPPORTED_CURRENCIES.map((currency) => {
                const total = totalsByCurrency[currency];
                if (total === undefined) return null;

                return (
                  <div key={currency} className="flex items-baseline gap-1.5">
                    <span className="font-(family-name:--font-jb-mono) text-lg font-bold tabular-nums text-foreground tracking-tight">
                      {fmt(total, currency)}
                    </span>
                    <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground font-semibold">
                      {currency}
                    </span>
                  </div>
                );
              })}
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
        <section className="rounded-lg border border-border bg-card/40 backdrop-blur-sm overflow-hidden">
          <PerformanceChartClient
            userId={userId}
            scope={{ kind: "portfolio", displayCurrency }}
            controls={<DisplayCurrencyToggle displayCurrency={displayCurrency} />}
          />
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
            <div className="py-20 text-center border border-dashed border-border/70 rounded-lg">
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
                <Wallet key={w.id} userId={userId} wallet={w} />
              ))}
            </div>
          )}
        </section>

      </main>
    </div>
  );
}
