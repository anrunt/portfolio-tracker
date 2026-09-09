"use client";

import { useQuery } from "@tanstack/react-query";
import {
  chartResponseSchema,
  getChartQueryKey,
  type ChartScope,
} from "@/lib/chart-query";
import type { TimeRange } from "@/server/actions/types";

export function useChartData(userId: string, scope: ChartScope, range: TimeRange) {
  const queryKey = getChartQueryKey(userId, scope, range);

  return useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const params = new URLSearchParams({ range });
      let path: string;

      if (scope.kind === "wallet") {
        path = `/api/wallets/${encodeURIComponent(scope.walletId)}/chart`;
      } else {
        path = "/api/portfolio/chart";
        params.set("currency", scope.displayCurrency);
      }

      const response = await fetch(`${path}?${params}`, {
        signal,
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("Unable to load performance history.");
      }

      return chartResponseSchema.parse(await response.json());
    },
    staleTime: 60_000,
    retry: false,
    placeholderData: (previousData, previousQuery) => {
      // Keep the previous range visible only for the same user, chart and currency.
      const sameChart = queryKey.slice(0, -1).every(
        (part, index) => previousQuery?.queryKey[index] === part,
      );
      return sameChart ? previousData : undefined;
    },
  });
}
