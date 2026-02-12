"use client"

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
      ? "text-emerald-600 dark:text-emerald-400"
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
      className={`w-full ${gridLayoutClass} p-4 transition-colors group/item border-b border-border/50 last:border-0 hover:bg-accent/50 dark:bg-secondary dark:hover:bg-primary/20`}
    >
      <div className="text-muted-foreground/70 font-mono text-sm flex items-center">
        <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 mr-2 group-hover/item:bg-muted-foreground/70 transition-colors" />
      </div>
      
      <div className="text-muted-foreground text-sm truncate">
      </div>

      <div className="text-right font-mono text-sm text-foreground/70">
        {quantity}
      </div>
      
      <div className="text-right font-mono text-sm text-foreground">
        {formatNumber(totalValue)}{" "}
        <span className="text-[10px] text-foreground/70">{currency}</span>
      </div>

      <div className="text-right font-mono text-sm text-foreground">
        {formatNumber(pricePerShare)}{" "}
        <span className="text-[10px] text-foreground/70">{currency}</span>
      </div>

      <div className="text-right font-mono text-sm text-foreground">
        {typeof currentPrice === "number" ? (
          <>
            {formatNumber(currentPrice)}{" "}
            <span className="text-[10px] text-foreground/70">{currency}</span>
          </>
        ) : (
          "N/A"
        )}
      </div>

      <div className={`text-right font-mono text-sm ${plColor}`}>
        {typeof unrealizedPl === "number" ? (
          <div className="flex flex-col items-end leading-snug">
            <span>
              {formatPl(unrealizedPl)}{" "}
              <span className="text-[10px] text-foreground/70">{currency}</span>
            </span>
            {typeof unrealizedPlPercent === "number" && (
              <span className="text-sm">{formatPlPercent(unrealizedPlPercent)}</span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground">N/A</span>
        )}
      </div>

      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="flex items-center justify-center text-muted-foreground/70 hover:text-destructive transition-colors shrink-0 p-2"
            >
              <Trash2 className="size-4" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Position - {companySymbol}</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this position?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <form action={deletePositionWithId}>
                <button
                  type="submit"
                  className="h-9 px-4 py-2 flex items-center justify-center gap-1 rounded-md bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors text-sm font-medium w-full sm:w-auto"
                >
                  Delete
                  <Trash2 className="size-4" />
                </button>
              </form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
