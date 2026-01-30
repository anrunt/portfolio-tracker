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
}

export default function MainPosition({
  companySymbol,
  positions,
  walletId,
  currency,
}: MainPositionProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const companyName = positions[0]?.companyName ?? "";

  const totalQuantity = positions.reduce((sum, pos) => sum + pos.quantity, 0);
  const totalValue = positions.reduce(
    (sum, pos) => sum + pos.pricePerShare * pos.quantity,
    0,
  );
  const weightedAveragePrice =
    totalQuantity > 0 ? totalValue / totalQuantity : 0;

  const formatNumber = (value: number) =>
    value.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
      maximumFractionDigits: 2,
    });

  return (
    <div
      className="border border-gray-600 rounded-xl bg-card/50 cursor-pointer"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex w-full items-center justify-between p-4">
        <div className="flex items-center gap-4">
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform duration-300 ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
          <span className="font-bold text-xl">{companySymbol}</span>
          <span className="text-muted-foreground">{companyName}</span>
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center">
            <span className="text-muted-foreground">Total Qty:</span>
            <span className="font-medium w-10 text-right">{totalQuantity}</span>
          </div>
          <div className="flex items-center">
            <span className="text-muted-foreground">Avg Price:</span>
            <span className="font-medium w-20 text-right">
              {formatNumber(weightedAveragePrice)} {currency}
            </span>
          </div>
          <div className="flex items-center">
            <span className="text-muted-foreground">Total Value:</span>
            <span className="font-medium w-20 text-right">
              {formatNumber(totalValue)} {currency}
            </span>
          </div>
        </div>
      </div>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
          isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div
            className="flex flex-col gap-2 px-4 pb-4"
            onClick={(e) => e.stopPropagation()}
          >
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
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
