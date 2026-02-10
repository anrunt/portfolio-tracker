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

  const totalValue = positions.reduce((sum, pos) => sum + pos.pricePerShare * pos.quantity,0);

  const weightedAveragePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

  const formatNumber = (value: number) =>
    value.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

  return (
    <div
      className={`group border rounded-xl overflow-hidden mb-3 transition-colors duration-300 ${
        isExpanded
          ? "border-primary bg-card dark:bg-background"
          : "border-border bg-card dark:bg-background hover:border-muted-foreground/50 dark:hover:border-primary/50"
      }`}
    >
      <div
        className={`${gridLayoutClass} w-full p-4 cursor-pointer select-none`}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="font-medium text-foreground text-lg">{companySymbol}</div>
        <div className="text-foreground/70 truncate font-light">{companyName}</div>
        <div className="text-right font-mono text-foreground">{totalQuantity}</div>
        <div className="text-right font-mono font-medium text-foreground">
          {formatNumber(totalValue)} <span className="text-xs text-foreground/70">{currency}</span>
        </div>
        <div className="text-right font-mono text-foreground">
          {formatNumber(weightedAveragePrice)} <span className="text-xs text-foreground/70">{currency}</span>
        </div>
        <div className="text-right font-mono text-foreground">
          {typeof currentPrice === "number" ? (
            <>
              {formatNumber(currentPrice)} <span className="text-xs text-foreground/70">{currency}</span>
            </>
          ) : (
            "N/A"
          )}
        </div>
        <div className="flex justify-end">
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${
              isExpanded ? "rotate-180 text-foreground" : ""
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
          <div className="flex flex-col border-t border-border">
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
