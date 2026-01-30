"use client"

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
  const companyName = positions[0]?.companyName ?? "";

  const totalQuantity = positions.reduce((sum, pos) => sum + pos.quantity, 0);
  const totalValue = positions.reduce(
    (sum, pos) => sum + pos.pricePerShare * pos.quantity,
    0,
  );
  const weightedAveragePrice = totalQuantity > 0 ? totalValue / totalQuantity : 0;

  const formatNumber = (value: number) =>
    value.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
      maximumFractionDigits: 2,
    });

  return (
    <div className="border border-gray-600 rounded-xl p-4 bg-card/50">
      <div className="flex items-center justify-between mb-4 px-2">
        <div className="flex items-center gap-4">
          <span className="font-bold text-xl">{companySymbol}</span>
          <span className="text-muted-foreground">{companyName}</span>
        </div>
        <div className="flex items-center gap-8 text-sm">
          <div className="text-right">
            <span className="text-muted-foreground">Total Qty: </span>
            <span className="font-medium">{totalQuantity}</span>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">Avg Price: </span>
            <span className="font-medium">
              {formatNumber(weightedAveragePrice)} {currency}
            </span>
          </div>
          <div className="text-right">
            <span className="text-muted-foreground">Total Value: </span>
            <span className="font-medium">
              {formatNumber(totalValue)} {currency}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2">
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
  );
}
