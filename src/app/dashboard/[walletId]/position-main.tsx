"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import Position from "./position";

interface PositionData {
  id: string;
  companySymbol: string;
  companyName: string;
  quantity: number;
  pricePerShare: number;
}

interface MainPositionProps {
  companySymbol: string;
  positions: PositionData[];
  walletId: string;
  currency: string;
  currentPrice?: number;
  gridLayoutClass: string;
}

export default function MainPosition({
  companySymbol,
  positions,
  walletId,
  currency,
  currentPrice,
  gridLayoutClass,
}: MainPositionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const companyName = positions[0]?.companyName ?? "";

  const totalQuantity = positions.reduce((sum, pos) => sum + pos.quantity, 0);

  const totalValue = positions.reduce(
    (sum, pos) => sum + pos.pricePerShare * pos.quantity,
    0
  );

  const weightedAveragePrice =
    totalQuantity > 0 ? totalValue / totalQuantity : 0;

  const formatNumber = (value: number) =>
    value.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

  const unrealizedPl =
    typeof currentPrice === "number"
      ? (currentPrice - weightedAveragePrice) * totalQuantity
      : undefined;

  const unrealizedPlPercent =
    typeof currentPrice === "number" && weightedAveragePrice > 0
      ? ((currentPrice - weightedAveragePrice) / weightedAveragePrice) * 100
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
      className={`group border rounded overflow-hidden mb-1 transition-all duration-150 ${
        isExpanded
          ? "border-primary/50 bg-card/60"
          : "border-border bg-card/30 hover:border-primary/50"
      }`}
    >
      <div
        className={`${gridLayoutClass} w-full px-4 py-2.5 cursor-pointer select-none`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-2">
          <div className="w-1 h-1 rounded-full bg-primary group-hover:bg-primary transition-colors" />
          <span className="font-(family-name:--font-jb-mono) text-[12px] font-bold text-foreground tracking-wide">
            {companySymbol}
          </span>
        </div>
        <div className="font-(family-name:--font-jb-mono) text-[12px] text-foreground/60 truncate">
          {companyName}
        </div>
        <div className="text-right font-(family-name:--font-jb-mono) text-[12px] tabular-nums text-foreground">
          {totalQuantity}
        </div>
        <div className="text-right font-(family-name:--font-jb-mono) text-[12px] tabular-nums font-medium text-foreground">
          {formatNumber(totalValue)}{" "}
          <span className="text-[9px] text-muted-foreground font-semibold">
            {currency}
          </span>
        </div>
        <div className="text-right font-(family-name:--font-jb-mono) text-[12px] tabular-nums text-foreground">
          {formatNumber(weightedAveragePrice)}{" "}
          <span className="text-[9px] text-muted-foreground font-semibold">
            {currency}
          </span>
        </div>
        <div className="text-right font-(family-name:--font-jb-mono) text-[12px] tabular-nums text-foreground">
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
          className={`text-right font-(family-name:--font-jb-mono) text-[12px] tabular-nums ${plColor}`}
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
                <span className="text-[11px]">
                  {formatPlPercent(unrealizedPlPercent)}
                </span>
              )}
            </div>
          ) : (
            <span className="text-muted-foreground/40">N/A</span>
          )}
        </div>
        <div className="flex justify-end">
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${
              isExpanded ? "rotate-180 text-primary" : ""
            }`}
          />
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="flex flex-col border-t border-border/50">
            {positions.map((pos) => (
              <Position
                key={pos.id}
                walletId={walletId}
                positionId={pos.id}
                companySymbol={pos.companySymbol}
                companyName={pos.companyName}
                quantity={pos.quantity}
                pricePerShare={pos.pricePerShare}
                currency={currency}
                currentPrice={currentPrice}
                gridLayoutClass={gridLayoutClass}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
