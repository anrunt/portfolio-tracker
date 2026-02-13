import { PriceResultData } from "@/server/actions/types";
import { useQuery } from "@tanstack/react-query";

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

  // Process data into failedPriceSymbols and currentPricesBySymbol and return it
}