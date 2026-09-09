import { getWalletChartData } from "@/server/services/chart-data";
import { TimeRange } from "@/server/actions/types";
import PerformanceChartClient from "../performance-chart-client";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { getQueryClient } from "@/app/get-query-clients";
import { getChartQueryKey, type ChartResponse } from "@/lib/chart-query";

interface Props {
  userId: string;
  walletId: string;
  range: TimeRange;
}

export default async function WalletChart({ userId, walletId, range }: Props) {
  const result = await getWalletChartData(walletId, range);
  const queryClient = getQueryClient();

  if (result.isOk()) {
    queryClient.setQueryData(
      getChartQueryKey(userId, { kind: "wallet", walletId }, range),
      { points: result.value } satisfies ChartResponse,
    );
  }

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <PerformanceChartClient userId={userId} scope={{ kind: "wallet", walletId }} />
    </HydrationBoundary>
  );
}
