import type { SupportedCurrency } from "@/domain/currency";
import { usePrices } from "@/hooks/use-prices";
import type { PositionData, WalletMetrics } from "@/server/actions/types";

interface UsePortfolioStatsParams {
  wallet: WalletMetrics;
  positions: PositionData[];
  groupedPositions: Record<string, PositionData[]>;
  symbols: string[];
  exchange: string;
  currency: SupportedCurrency;
}

export function usePortfolioStats({
  wallet,
  positions,
  groupedPositions,
  symbols,
  exchange,
  currency,
}: UsePortfolioStatsParams) {
  const {
    pricesBySymbol,
    failedSymbols,
    dataUpdatedAt,
    isLoadingPrices,
    isRefreshingPrices,
    hasPriceError,
  } = usePrices({
    symbols,
    exchange,
  });

  const holdingsCostBasis = positions.reduce(
    (sum, pos) => sum + pos.pricePerShare * pos.quantity,
    0
  );
  const totalPositions = positions.length;
  const uniqueSymbols = Object.keys(groupedPositions).length;

  let pricedHoldingsValue = 0;
  let hasMissingPrices = false;
  for (const pos of positions) {
    const livePrice = !failedSymbols.has(pos.companySymbol)
      ? pricesBySymbol.get(pos.companySymbol)
      : undefined;

    if (typeof livePrice === "number") {
      pricedHoldingsValue += livePrice * pos.quantity;
    } else {
      hasMissingPrices = true;
    }
  }

  const holdingsValue = hasMissingPrices ? null : pricedHoldingsValue;
  const portfolioValue = holdingsValue === null ? null : holdingsValue + wallet.cashBalance;
  const netInvested = wallet.totalContributed - wallet.totalWithdrawn;
  const unrealizedPl = holdingsValue === null ? null : holdingsValue - holdingsCostBasis;
  const realizedPl = wallet.realizedPl;
  const totalPl = portfolioValue === null ? null : portfolioValue - netInvested;
  let totalPlPercent: number | null = null;
  if (totalPl !== null) {
    totalPlPercent = netInvested > 0 ? (totalPl / netInvested) * 100 : 0;
  }

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
    holdingsCostBasis,
    holdingsValue,
    portfolioValue,
    netInvested,
    unrealizedPl,
    realizedPl,
    totalPl,
    totalPlPercent,
    totalPositions,
    uniqueSymbols,
    hasMissingPrices,
    isLoadingPrices,
    isRefreshingPrices,
    hasPriceError,
    formatCurrency,
    formatPl,
    formatPlPercent,
  };
}

export type PortfolioStats = ReturnType<typeof usePortfolioStats>;
