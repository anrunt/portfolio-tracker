import { PriceResultData } from "@/server/actions/types";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

interface UsePricesParams {
  symbols: string[];
  exchange: string;
  initialData: PriceResultData
}

export function usePrices({symbols, exchange, initialData} : UsePricesParams) {
  const { data, dataUpdatedAt } = useQuery<PriceResultData>({
    queryKey: ["prices", symbols, exchange],
    queryFn: async () => {
      const result = await fetch(
        `/api/stock?symbol=${symbols.join(",")}&exchange=${exchange}`
      );

      if (!result.ok) {
        throw new Error("Failed to fetch prices");
      }

      return result.json() as Promise<PriceResultData>;
    },
    initialData: initialData,
    refetchInterval: 60_000
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
    dataUpdatedAt
  }
}