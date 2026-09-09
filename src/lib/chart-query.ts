import { z } from "zod";
import type { SupportedCurrency } from "@/domain/currency";
import type { TimeRange } from "@/server/actions/types";

export const TIME_RANGES = ["1D", "1W", "1M", "3M", "6M", "1YR"] as const satisfies readonly TimeRange[];
export const timeRangeSchema = z.enum(TIME_RANGES);

export const chartResponseSchema = z.object({
  points: z.array(
    z.object({
      timestamp: z.number(),
      label: z.string().optional(),
      totalValue: z.number(),
      netInvested: z.number(),
    }),
  ),
});

export type ChartResponse = z.infer<typeof chartResponseSchema>;

export type ChartScope =
  | { kind: "wallet"; walletId: string }
  | { kind: "portfolio"; displayCurrency: SupportedCurrency };

export const chartQueryKeys = {
  wallet: (userId: string, walletId: string) =>
    ["charts", userId, "wallet", walletId] as const,
  portfolio: (userId: string) => ["charts", userId, "portfolio"] as const,
};

export function getChartQueryKey(
  userId: string,
  scope: ChartScope,
  range: TimeRange,
) {
  return scope.kind === "wallet"
    ? [...chartQueryKeys.wallet(userId, scope.walletId), range] as const
    : [...chartQueryKeys.portfolio(userId), scope.displayCurrency, range] as const;
}
