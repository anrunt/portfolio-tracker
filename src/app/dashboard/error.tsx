"use client";

import { useEffect } from "react";
import Link from "next/link";
import { JetBrains_Mono } from "next/font/google";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jb-mono",
});

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("[dashboard] route error:", error);
  }, [error]);

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
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse" />
            <span className="font-(family-name:--font-jb-mono) text-[11px] font-bold tracking-[0.2em] uppercase text-destructive">
              System Fault
            </span>
          </div>
          <ModeToggle size="icon-sm" />
        </div>
      </header>

      <main className="relative max-w-3xl mx-auto px-6 py-16">
        <section className="rounded-lg border border-border bg-card/40 backdrop-blur-sm overflow-hidden">
          <div className="px-5 py-2.5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-1.5 h-1.5 rounded-full bg-destructive/60" />
              <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.2em] uppercase font-medium">
                Error Trace
              </span>
            </div>
            {error.digest ? (
              <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground/60 tracking-[0.15em]">
                ID: {error.digest}
              </span>
            ) : null}
          </div>

          <div className="px-8 py-12 relative">
            <div
              className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none"
              style={{
                backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, currentColor 3px, currentColor 4px)`,
              }}
            />

            <div className="relative space-y-8">
              <div className="space-y-3">
                <p className="font-(family-name:--font-jb-mono) text-[10px] text-destructive tracking-[0.25em] uppercase">
                  Status: 500 — Unrecoverable
                </p>
                <h1 className="font-(family-name:--font-jb-mono) text-3xl font-bold tracking-tight text-foreground">
                  Dashboard could not load.
                </h1>
                <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
                  We hit an unexpected condition while assembling your
                  portfolio. The data shown may be incomplete or stale until
                  this is resolved.
                </p>
              </div>

              <div className="rounded border border-destructive/30 bg-destructive/5 px-4 py-3">
                <p className="font-(family-name:--font-jb-mono) text-[10px] text-destructive/80 tracking-[0.2em] uppercase mb-1.5">
                  Reason
                </p>
                <p className="font-(family-name:--font-jb-mono) text-xs text-foreground/90 break-words leading-relaxed">
                  {error.message || "Unknown error"}
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={() => reset()}
                  size="default"
                  className="font-(family-name:--font-jb-mono) text-[11px] tracking-[0.18em] uppercase"
                >
                  Retry
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="default"
                  className="font-(family-name:--font-jb-mono) text-[11px] tracking-[0.18em] uppercase"
                >
                  <Link href="/">Return Home</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground/40 tracking-[0.2em] uppercase text-center mt-6">
          If the issue persists, refresh the page or sign out and back in.
        </p>
      </main>
    </div>
  );
}
