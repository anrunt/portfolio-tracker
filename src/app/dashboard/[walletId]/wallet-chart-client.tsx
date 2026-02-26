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
    <Card>
      <CardHeader>
        <CardTitle>Portfolio Value</CardTitle>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
          <LineChart
            accessibilityLayer
            data={data}
            margin={{ left: 12, right: 12 }}
          >
            <CartesianGrid vertical={false} />
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
