"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { TrendingUp } from "lucide-react";
import { sellAllPositionsForSymbol } from "@/server/actions/dashboard/position-sell-actions";

interface SellAllPositionData {
  id: string;
  companySymbol: string;
  companyName: string;
  quantity: number;
  pricePerShare: number;
}

interface SellAllSymbolDialogProps {
  walletId: string;
  companySymbol: string;
  companyName: string;
  positions: SellAllPositionData[];
  currency: string;
  currentPrice?: number;
}

const initialState = {
  message: "",
  success: false,
  timestamp: 0,
  fieldErrors: undefined,
};

export default function SellAllSymbolDialog({
  walletId,
  companySymbol,
  companyName,
  positions,
  currency,
  currentPrice,
}: SellAllSymbolDialogProps) {
  const [open, setOpen] = useState(false);

  let totalQuantity = 0;
  let totalCostBasis = 0;
  for (const position of positions) {
    totalQuantity += position.quantity;
    totalCostBasis += position.quantity * position.pricePerShare;
  }

  const averageBuyPrice = totalQuantity > 0 ? totalCostBasis / totalQuantity : 0;
  const defaultSellPrice = currentPrice ?? averageBuyPrice;

  const [sellPrice, setSellPrice] = useState(String(defaultSellPrice));
  const [withdrawAfterSale, setWithdrawAfterSale] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState("");

  const sellAllWithIds = sellAllPositionsForSymbol.bind(null, walletId, companySymbol);
  const [state, formAction, pending] = useActionState(sellAllWithIds, initialState);

  const parsedPrice = Number(sellPrice);
  const parsedWithdrawAmount = Number(withdrawAmount);

  const hasValidPrice = Number.isFinite(parsedPrice) && parsedPrice > 0;
  const hasValidWithdrawal = Number.isFinite(parsedWithdrawAmount) && parsedWithdrawAmount >= 0;

  const totalProceeds = hasValidPrice ? totalQuantity * parsedPrice : 0;

  let estimatedRealizedPl = 0;
  if (hasValidPrice) {
    for (const position of positions) {
      estimatedRealizedPl += (parsedPrice - position.pricePerShare) * position.quantity;
    }
  }

  const withdrawalPreview = withdrawAfterSale && hasValidWithdrawal ? parsedWithdrawAmount : 0;
  const withdrawalWarning = withdrawAfterSale && hasValidWithdrawal && parsedWithdrawAmount > totalProceeds
    ? "Withdrawal exceeds sale proceeds"
    : undefined;

  const realizedPlColor = estimatedRealizedPl > 0
    ? "text-emerald-500"
    : estimatedRealizedPl < 0
      ? "text-red-500 dark:text-red-400"
      : "text-muted-foreground";

  const formatNumber = (value: number) =>
    value.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

  const formatQuantity = (value: number) =>
    value.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
      maximumFractionDigits: 10,
    });

  const formatPl = (value: number) => {
    const sign = value > 0 ? "+" : value < 0 ? "\u2212" : "";
    return sign + formatNumber(Math.abs(value));
  };

  useEffect(() => {
    if (state.success === true && state.timestamp !== 0) {
      startTransition(() => {
        setOpen(false);
      });
    }
  }, [state.success, state.timestamp]);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => event.stopPropagation()}
          className="flex items-center justify-center text-muted-foreground/40 hover:text-primary transition-colors shrink-0 p-1"
          aria-label={`Sell all ${companySymbol} positions`}
        >
          <TrendingUp className="size-3.5" />
        </button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-125 bg-background border-border/50 p-0 gap-0 overflow-hidden"
        aria-describedby={undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="font-(family-name:--font-jb-mono) text-sm font-bold tracking-wide text-foreground">
            SELL_ALL_{companySymbol}
          </DialogTitle>
          <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-wider mt-1">
            Target: <span className="text-primary font-semibold">{companySymbol}</span>
            {companyName ? <span className="text-muted-foreground/60"> · {companyName}</span> : null}
          </p>
        </DialogHeader>

        <form action={formAction} className="px-6 pt-4 pb-6 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded border border-border/60 bg-muted/20 px-3 py-2.5">
              <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Total quantity
              </p>
              <p className="font-(family-name:--font-jb-mono) text-[12px] tabular-nums text-foreground mt-1">
                {formatQuantity(totalQuantity)} shares
              </p>
            </div>
            <div className="rounded border border-border/60 bg-muted/20 px-3 py-2.5">
              <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Positions
              </p>
              <p className="font-(family-name:--font-jb-mono) text-[12px] tabular-nums text-foreground mt-1">
                {positions.length}
              </p>
            </div>
            <div className="rounded border border-border/60 bg-muted/20 px-3 py-2.5">
              <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                Avg buy
              </p>
              <p className="font-(family-name:--font-jb-mono) text-[12px] tabular-nums text-foreground mt-1">
                {formatNumber(averageBuyPrice)} <span className="text-[9px] text-muted-foreground font-semibold">{currency}</span>
              </p>
            </div>
          </div>

          <label className="space-y-1.5 block">
            <span className="font-(family-name:--font-jb-mono) text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
              Sell price per share
            </span>
            <input
              name="price"
              type="number"
              step="any"
              min="0"
              value={sellPrice}
              onChange={(event) => setSellPrice(event.target.value)}
              className="w-full rounded border border-border bg-background px-3 py-2 font-(family-name:--font-jb-mono) text-[12px] tabular-nums outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/30"
            />
            {state.fieldErrors?.price && (
              <p className="font-(family-name:--font-jb-mono) text-[10px] text-destructive">
                {state.fieldErrors.price}
              </p>
            )}
          </label>

          <div className="rounded border border-border/60 bg-card/40 overflow-hidden">
            <div className="grid grid-cols-2 divide-x divide-border/50">
              <div className="px-3 py-3">
                <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Total proceeds
                </p>
                <p className="font-(family-name:--font-jb-mono) text-[13px] tabular-nums text-foreground mt-1">
                  {formatNumber(totalProceeds)} <span className="text-[9px] text-muted-foreground font-semibold">{currency}</span>
                </p>
              </div>
              <div className="px-3 py-3">
                <p className="font-(family-name:--font-jb-mono) text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                  Estimated realized P/L
                </p>
                <p className={`font-(family-name:--font-jb-mono) text-[13px] tabular-nums mt-1 ${realizedPlColor}`}>
                  {formatPl(estimatedRealizedPl)} <span className="text-[9px] text-muted-foreground font-semibold">{currency}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="rounded border border-border/60 bg-muted/10 px-4 py-3 space-y-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                name="withdrawAfterSale"
                type="checkbox"
                checked={withdrawAfterSale}
                onChange={(event) => setWithdrawAfterSale(event.target.checked)}
                className="size-3.5 accent-primary"
              />
              <span className="font-(family-name:--font-jb-mono) text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Withdraw from sale proceeds
              </span>
            </label>

            <label className="space-y-1.5 block">
              <span className="font-(family-name:--font-jb-mono) text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                Withdrawal amount
              </span>
              <input
                name="withdrawAmount"
                type="number"
                step="any"
                min="0"
                value={withdrawAmount}
                disabled={!withdrawAfterSale}
                onChange={(event) => setWithdrawAmount(event.target.value)}
                placeholder="0.00"
                className="w-full rounded border border-border bg-background px-3 py-2 font-(family-name:--font-jb-mono) text-[12px] tabular-nums outline-none transition-colors focus:border-primary/60 focus:ring-1 focus:ring-primary/30 disabled:opacity-45 disabled:cursor-not-allowed"
              />
              {(state.fieldErrors?.withdrawAmount || withdrawalWarning) && (
                <p className="font-(family-name:--font-jb-mono) text-[10px] text-destructive">
                  {state.fieldErrors?.withdrawAmount ?? withdrawalWarning}
                </p>
              )}
              {withdrawAfterSale && (
                <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground/70">
                  Cash added after withdrawal: {formatNumber(Math.max(totalProceeds - withdrawalPreview, 0))} {currency}
                </p>
              )}
            </label>
          </div>

          {state.message && !state.success && (
            <div className="rounded border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="font-(family-name:--font-jb-mono) text-[11px] text-destructive leading-relaxed">
                {state.message}
              </p>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
            <DialogClose asChild>
              <button
                type="button"
                disabled={pending}
                className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </DialogClose>
            <button
              type="submit"
              disabled={pending}
              className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              {pending ? "Selling..." : "Sell All"}
              <TrendingUp className="size-3" />
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
