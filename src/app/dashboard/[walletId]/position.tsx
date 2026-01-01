interface PositionProps {
  walletId: string;
  positionId: string;
  companySymbol: string;
  companyName: string;
  quantity: number;
  pricePerShare: number;
  currency: string;
}

export default function Position({
  walletId,
  positionId,
  companySymbol,
  companyName,
  quantity,
  pricePerShare,
  currency,
}: PositionProps) {
  return (
    <div className="w-full px-6 py-4 border border-gray-700 rounded-lg flex items-center justify-between bg-card text-card-foreground">
      <div className="flex items-center gap-6 w-1/3">
        <span className="font-medium text-lg w-16 shrink-0">{companySymbol}</span>
        <span className="text-muted-foreground truncate">{companyName}</span>
      </div>

      <div className="flex-1 flex justify-center">
        <span className="text-lg">{quantity}</span>
      </div>

      <div className="w-1/3 flex justify-end">
        <span className="text-lg font-medium">
          {pricePerShare.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
//            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}{" "}
          {currency}
        </span>
      </div>
    </div>
  );
}

