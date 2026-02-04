import { getSession } from "@/server/better-auth/session";
import { QUERIES } from "@/server/db/queries";
import { redirect } from "next/navigation";
import Search from "./search";
import MainPosition from "./position-main";
import { TrendingUp, PieChart, ArrowLeft, Wallet } from "lucide-react";
import Link from "next/link";
import { ModeToggle } from "@/components/mode-toggle";

interface WalletPageProps {
  params: Promise<{ walletId: string }>;
}

export default async function WalletPage({ params }: WalletPageProps) {
  const { walletId } = await params;

  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const wallet = await QUERIES.getWalletById(walletId, session.user.id);
  if (!wallet) {
    redirect("/dashboard");
  }

  const positions = await QUERIES.getWalletPositions(walletId, session.user.id);

  const groupedPositions: Record<string, typeof positions> = {};
  for (const pos of positions) {
    (groupedPositions[pos.companySymbol] ??= []).push(pos);
  }

  const totalValue = positions.reduce((sum, pos) => sum + pos.pricePerShare * pos.quantity,0);
  const totalPositions = positions.length;
  const uniqueSymbols = Object.keys(groupedPositions).length;

  const formatCurrency = (value: number) =>
    value.toLocaleString(wallet.currency === "USD" ? "en-US" : "pl-PL", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

  const gridLayoutClass = "grid grid-cols-[80px_2fr_100px_140px_140px_140px_60px] gap-4 items-center";

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
          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <TrendingUp className="w-3.5 h-3.5" />
              Total Value
            </div>
            <div className="text-2xl font-semibold tabular-nums text-card-foreground">
              {formatCurrency(totalValue)}
              <span className="text-sm text-muted-foreground ml-1">{wallet.currency}</span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-card border border-border">
            <div className="flex items-center gap-2 text-muted-foreground text-xs uppercase tracking-wider mb-2">
              <PieChart className="w-3.5 h-3.5" />
              Portfolio
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-lg font-medium tabular-nums text-card-foreground">{uniqueSymbols}</div>
                <div className="text-xs text-muted-foreground">Companies</div>
              </div>
              <div>
                <div className="text-lg font-medium tabular-nums text-card-foreground">{totalPositions}</div>
                <div className="text-xs text-muted-foreground">Positions</div>
              </div>
            </div>
          </div>

          <div className="flex justify-center pt-2">
            <Search />
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight mb-2 text-muted-foreground">Positions</h2>
            <p className="text-muted-foreground">Manage your portfolio holdings</p>
          </div>

          {/* Positions Container */}
          <div className="rounded-2xl border border-border/60 bg-linear-to-b from-card/50 to-card/30 backdrop-blur-sm shadow-lg shadow-black/5 overflow-hidden">
            {/* Header */}
            <div className="hidden md:block border-b border-border/40 bg-muted/30 px-2 py-4">
              <div className={`${gridLayoutClass} px-4 text-xs uppercase tracking-wider text-muted-foreground font-medium`}>
                <div>Symbol</div>
                <div>Name</div>
                <div className="text-right">Qty</div>
                <div className="text-right">Total</div>
                <div className="text-right">Avg Price</div>
                <div className="text-right">Current</div>
                <div></div>
              </div>
            </div>

            {/* Scrollable Positions Area */}
            <div className="h-[40vh] overflow-y-auto custom-scrollbar p-4">
              {positions.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                  <Wallet className="w-12 h-12 mb-4 opacity-30" />
                  <p className="font-light">No positions yet</p>
                  <p className="text-sm text-muted-foreground/70 mt-1">Add your first position to get started</p>
                </div>
              ) : (
                <div className="flex flex-col gap-0">
                  {Object.entries(groupedPositions).map(([symbol, symbolPositions]) => (
                    <MainPosition
                      key={symbol}
                      companySymbol={symbol}
                      positions={symbolPositions!}
                      walletId={wallet.id}
                      currency={wallet.currency}
                      gridLayoutClass={gridLayoutClass}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
