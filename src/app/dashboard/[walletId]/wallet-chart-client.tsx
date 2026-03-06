"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CartesianGrid, Line, LineChart } from "recharts";
import { ChartDataPoint, TimeRange } from "@/server/actions/types";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { cn } from "@/lib/utils";

const TIME_RANGES: TimeRange[] = ["1D", "1W", "1M", "3M", "6M", "1YR"];

const chartConfig = {
  totalValue: {
    label: "Total Value",
    color: "var(--chart-1)",
  },
  totalCostBasis: {
    label: "Cost Basis",
    color: "var(--chart-2)",
  },
} satisfies ChartConfig;

function formatTimestamp(value: number) {
  return new Date(value).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface Props {
  walletId: string;
  range: TimeRange;
  data: ChartDataPoint[];
}

export default function WalletChartClient({ walletId, range, data }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRangeChange(newRange: TimeRange) {
    startTransition(() => {
      router.push(`/dashboard/${walletId}?range=${newRange}`);
    });
  }

  return (
    <div className={cn("transition-opacity duration-200", isPending && "opacity-60")}>
      <div className="px-5 py-2.5 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-1.5 rounded-full bg-primary/60" />
          <span className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.2em] uppercase font-medium">
            Performance Overview
          </span>
        </div>
        <div className="flex gap-0.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              disabled={isPending}
              className={cn(
                "px-2.5 py-1 font-(family-name:--font-jb-mono) text-[10px] rounded transition-all duration-150 cursor-pointer disabled:cursor-wait",
                r === range
                  ? "bg-primary text-primary-foreground font-semibold"
                  : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </div>

      <div className="relative">
        <div
          className="absolute inset-0 opacity-[0.015] dark:opacity-[0.03] pointer-events-none"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, transparent, transparent 3px, currentColor 3px, currentColor 4px)`,
          }}
        />
        <div className="px-5 py-4">
          <ChartContainer config={chartConfig} className="aspect-5/1 w-full">
            <LineChart
              accessibilityLayer
              data={data}
              margin={{ left: 8, right: 8, top: 4, bottom: 4 }}
            >
              <CartesianGrid vertical={false} strokeDasharray="3 3" />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    labelFormatter={(_, payload) => {
                      const point = payload[0]?.payload;
                      if (point?.label) {
                        return new Date(point.label + "T00:00:00").toLocaleDateString([], {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        });
                      } else {
                        return formatTimestamp(point?.timestamp);
                      }
                    }}
                  />
                }
              />
              <Line
                dataKey="totalValue"
                type="monotone"
                stroke="var(--color-totalValue)"
                strokeWidth={2}
                dot={false}
              />
              <Line
                dataKey="totalCostBasis"
                type="monotone"
                stroke="var(--color-totalCostBasis)"
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}
