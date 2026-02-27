"use client";

import { CartesianGrid, Line, LineChart } from "recharts";
import { ChartDataPoint } from "@/server/actions/types";
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
  data: ChartDataPoint[];
}

export default function WalletChartClient({ data }: Props) {
  return (
    <Card className="py-4 gap-3">
      <CardHeader className="px-5 pb-0">
        <CardTitle className="text-sm font-medium text-muted-foreground tracking-wide uppercase">
          Portfolio Value
        </CardTitle>
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
                  labelFormatter={(_, payload) =>
                    formatTimestamp(payload[0]?.payload?.timestamp)
                  }
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
