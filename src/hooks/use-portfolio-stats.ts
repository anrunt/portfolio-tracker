import { usePrices } from "@/hooks/use-prices";
import type { PositionData, PriceResultData } from "@/server/actions/types";

interface UsePortfolioStatsParams {
  positions: PositionData[];
  groupedPositions: Record<string, PositionData[]>;
  symbols: string[];
  exchange: string;
  currency: string;
  initialPriceData: PriceResultData;
}

export function usePortfolioStats({
  positions,
  groupedPositions,
  symbols,
  exchange,
  currency,
  initialPriceData,
}: UsePortfolioStatsParams) {
  const { pricesBySymbol, failedSymbols, dataUpdatedAt } = usePrices({
    symbols,
    exchange,
    initialData: initialPriceData,
  });

  const totalCostBasis = positions.reduce(
    (sum, pos) => sum + pos.pricePerShare * pos.quantity,
    0
  );
  const totalPositions = positions.length;
  const uniqueSymbols = Object.keys(groupedPositions).length;

  let totalCurrentValue = 0;
  let hasAnyPrice = false;
  for (const pos of positions) {
    const livePrice = !failedSymbols.has(pos.companySymbol)
      ? pricesBySymbol.get(pos.companySymbol)
      : undefined;
    if (typeof livePrice === "number") {
      totalCurrentValue += livePrice * pos.quantity;
      hasAnyPrice = true;
    } else {
      totalCurrentValue += pos.pricePerShare * pos.quantity;
    }
  }
  const totalPl = totalCurrentValue - totalCostBasis;
  const totalPlPercent =
    totalCostBasis > 0 ? (totalPl / totalCostBasis) * 100 : 0;

  const formatCurrency = (value: number) =>
    value.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });

  const formatPl = (value: number) => {
    const sign = value > 0 ? "+" : value < 0 ? "\u2212" : "";
    return sign + formatCurrency(Math.abs(value));
  };

  const formatPlPercent = (value: number) => {
    const sign = value > 0 ? "+" : value < 0 ? "\u2212" : "";
    return sign + Math.abs(value).toFixed(2) + "%";
  };

  const lastUpdated = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString()
    : null;

  return {
    pricesBySymbol,
    failedSymbols,
    dataUpdatedAt,
    lastUpdated,
    totalCostBasis,
    totalCurrentValue,
    totalPl,
    totalPlPercent,
    totalPositions,
    uniqueSymbols,
    hasAnyPrice,
    formatCurrency,
    formatPl,
    formatPlPercent,
  };
}
