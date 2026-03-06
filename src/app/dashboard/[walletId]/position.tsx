"use client";

import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Trash2 } from "lucide-react";
import { deletePosition } from "@/server/actions/dashboard-actions";

interface PositionProps {
  walletId: string;
  positionId: string;
  companySymbol: string;
  companyName: string;
  quantity: number;
  pricePerShare: number;
  currency: string;
  currentPrice?: number;
  gridLayoutClass: string;
}

export default function Position({
  walletId,
  positionId,
  companySymbol,
  companyName,
  quantity,
  pricePerShare,
  currency,
  currentPrice,
  gridLayoutClass,
}: PositionProps) {
  const deletePositionWithId = deletePosition.bind(null, positionId, walletId);
  const totalValue = pricePerShare * quantity;

  const formatNumber = (value: number) =>
    value.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

  const unrealizedPl =
    typeof currentPrice === "number"
      ? (currentPrice - pricePerShare) * quantity
      : undefined;

  const unrealizedPlPercent =
    typeof currentPrice === "number" && pricePerShare > 0
      ? ((currentPrice - pricePerShare) / pricePerShare) * 100
      : undefined;

  const plColor =
    unrealizedPl !== undefined && unrealizedPl > 0
      ? "text-emerald-500"
      : unrealizedPl !== undefined && unrealizedPl < 0
        ? "text-red-500 dark:text-red-400"
        : "text-muted-foreground";

  const formatPl = (value: number) => {
    const sign = value > 0 ? "+" : value < 0 ? "\u2212" : "";
    return sign + formatNumber(Math.abs(value));
  };

  const formatPlPercent = (value: number) => {
    const sign = value > 0 ? "+" : value < 0 ? "\u2212" : "";
    return sign + Math.abs(value).toFixed(2) + "%";
  };

  return (
    <div
      className={`w-full ${gridLayoutClass} px-4 py-2 transition-colors group/item border-b border-border/50 last:border-0 hover:bg-primary/5`}
    >
      <div className="font-(family-name:--font-jb-mono) text-[11px] text-muted-foreground/50 flex items-center">
        <div className="w-1 h-1 rounded-full bg-muted-foreground/30 mr-2 group-hover/item:bg-muted-foreground/60 transition-colors" />
      </div>

      <div className="font-(family-name:--font-jb-mono) text-[11px] text-muted-foreground/50 truncate"></div>

      <div className="text-right font-(family-name:--font-jb-mono) text-[11px] tabular-nums text-foreground/60">
        {quantity}
      </div>

      <div className="text-right font-(family-name:--font-jb-mono) text-[11px] tabular-nums text-foreground/70">
        {formatNumber(totalValue)}{" "}
        <span className="text-[9px] text-muted-foreground font-semibold">
          {currency}
        </span>
      </div>

      <div className="text-right font-(family-name:--font-jb-mono) text-[11px] tabular-nums text-foreground/70">
        {formatNumber(pricePerShare)}{" "}
        <span className="text-[9px] text-muted-foreground font-semibold">
          {currency}
        </span>
      </div>

      <div className="text-right font-(family-name:--font-jb-mono) text-[11px] tabular-nums text-foreground/70">
        {typeof currentPrice === "number" ? (
          <>
            {formatNumber(currentPrice)}{" "}
            <span className="text-[9px] text-muted-foreground font-semibold">
              {currency}
            </span>
          </>
        ) : (
          <span className="text-muted-foreground/40">N/A</span>
        )}
      </div>

      <div
        className={`text-right font-(family-name:--font-jb-mono) text-[11px] tabular-nums ${plColor}`}
      >
        {typeof unrealizedPl === "number" ? (
          <div className="flex flex-col items-end leading-snug">
            <span>
              {formatPl(unrealizedPl)}{" "}
              <span className="text-[9px] text-muted-foreground font-semibold">
                {currency}
              </span>
            </span>
            {typeof unrealizedPlPercent === "number" && (
              <span className="text-[10px]">
                {formatPlPercent(unrealizedPlPercent)}
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground/40">N/A</span>
        )}
      </div>

      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <button className="flex items-center justify-center text-muted-foreground/40 hover:text-destructive transition-colors shrink-0 p-1">
              <Trash2 className="size-3.5" />
            </button>
          </DialogTrigger>
          <DialogContent
            className="sm:max-w-[420px] bg-background border-border/50 p-0 gap-0 overflow-hidden"
            aria-describedby={undefined}
          >
            <DialogHeader className="px-6 pt-5 pb-0">
              <DialogTitle className="font-(family-name:--font-jb-mono) text-sm font-bold tracking-wide text-foreground">
                DELETE_POSITION
              </DialogTitle>
              <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-wider mt-1">
                Target:{" "}
                <span className="text-destructive font-semibold">
                  {companySymbol}
                </span>
              </p>
            </DialogHeader>

            <div className="px-6 pt-4 pb-6 space-y-4">
              <div className="rounded border border-destructive/20 bg-destructive/5 px-4 py-3">
                <p className="font-(family-name:--font-jb-mono) text-[11px] text-foreground leading-relaxed">
                  This action will permanently delete this position. This cannot
                  be undone.
                </p>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
                <DialogClose asChild>
                  <button
                    type="button"
                    className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all duration-150"
                  >
                    Cancel
                  </button>
                </DialogClose>
                <form action={deletePositionWithId}>
                  <button
                    type="submit"
                    className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/60 transition-all duration-150 flex items-center gap-1.5"
                  >
                    Delete
                    <Trash2 className="size-3" />
                  </button>
                </form>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
