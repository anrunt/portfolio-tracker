import { priceResultSchema } from "@/domain/prices";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface UsePricesParams {
  symbols: string[];
  exchange: string;
}

export function usePrices({symbols, exchange} : UsePricesParams) {
  const { data, dataUpdatedAt, isPending, isFetching, isError } = useQuery({
    queryKey: ["prices", symbols, exchange],
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({
        symbol: symbols.join(","),
        exchange,
      });

      const result = await fetch(
        `/api/stock?${params.toString()}`,
        { signal }
      );

      if (!result.ok) {
        throw new Error("Failed to fetch prices");
      }

      const payload: unknown = await result.json();
      return priceResultSchema.parse(payload);
    },
    enabled: symbols.length > 0,
    refetchInterval: 75_000 // Cache is 60s so we want fresh data with query refetch
  });

  const { pricesBySymbol, failedSymbols } = useMemo(() => {
    const pricesBySymbol = new Map<string, number>();
    const failedSymbols = new Set<string>();

    if (data) {
      for (const { symbol, price } of data.prices) {
        pricesBySymbol.set(symbol, price);
      }

      for (const { symbol } of data.failures) {
        failedSymbols.add(symbol);
      }
    }

    return { pricesBySymbol, failedSymbols };
  }, [data]);

  return {
    pricesBySymbol,
    failedSymbols,
    dataUpdatedAt,
    isLoadingPrices: symbols.length > 0 && isPending,
    isRefreshingPrices: !isPending && isFetching,
    hasPriceError: isError,
  }
}
