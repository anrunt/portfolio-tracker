import type { PriceResultData } from "@/server/actions/types";
import type { MarketPriceResultData } from "./types";

export function toPriceResultData(
  data: MarketPriceResultData,
): PriceResultData {
  return {
    prices: data.prices.map(({ symbol, price }) => ({ symbol, price })),
    failures: data.failures,
  };
}
