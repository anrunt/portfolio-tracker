"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CartesianGrid, Line, LineChart } from "recharts";
import { ChartDataPoint, TimeRange } from "@/server/actions/types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
    <Card className={cn("py-4 gap-3 transition-opacity duration-200", isPending && "opacity-60")}>
      <CardHeader className="px-5 pb-0 flex flex-row items-center justify-between">
        <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
          Portfolio Value
        </CardTitle>
        <div className="flex items-center gap-1 rounded-lg border border-border p-0.5">
          {TIME_RANGES.map((r) => (
            <button
              key={r}
              onClick={() => handleRangeChange(r)}
              disabled={isPending}
              className={cn(
                "px-2.5 py-1 text-xs font-semibold rounded-md transition-all duration-150 cursor-pointer",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                r === range
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted"
              )}
            >
              {r}
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-1">
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
      </CardContent>
    </Card>
  );
}
