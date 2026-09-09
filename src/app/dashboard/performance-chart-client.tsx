"use client";

import { useSearchParams } from "next/navigation";
import type { ReactNode } from "react";
import { useChartData } from "@/hooks/use-chart-data";
import { timeRangeSchema, type ChartScope } from "@/lib/chart-query";
import type { TimeRange } from "@/server/actions/types";
import PerformanceChart from "./performance-chart";

interface Props {
  userId: string;
  scope: ChartScope;
  controls?: ReactNode;
}

export default function PerformanceChartClient({ userId, scope, controls }: Props) {
  const searchParams = useSearchParams();
  const range = timeRangeSchema.catch("1D").parse(searchParams.get("range"));
  const { data, isPending, isFetching, isError } = useChartData(
    userId,
    scope,
    range,
  );

  function handleRangeChange(nextRange: TimeRange) {
    if (nextRange === range) return;
    const url = new URL(window.location.href);
    url.searchParams.set("range", nextRange);
    window.history.pushState(null, "", `${url.pathname}${url.search}${url.hash}`);
  }

  let content: ReactNode;
  if (isPending) {
    content = (
      <div role="status" className="px-5 py-4">
        <span className="sr-only">Loading performance chart</span>
        <div className="aspect-5/1 w-full animate-pulse rounded bg-muted" />
      </div>
    );
  } else if (!data && isError) {
    content = (
      <p role="alert" className="px-5 py-8 text-center text-xs text-destructive">
        Unable to load performance history. Please try again later.
      </p>
    );
  } else if (data?.points.length === 0) {
    content = (
      <p className="px-5 py-8 text-center text-xs text-muted-foreground">
        No performance history for this range.
      </p>
    );
  }

  return (
    <>
      <PerformanceChart
        range={range}
        data={data?.points ?? []}
        onRangeChange={handleRangeChange}
        isRefreshing={isFetching}
        controls={controls}
      >
        {content}
      </PerformanceChart>
      {isError && data && (
        <p role="alert" className="px-5 pb-3 text-xs text-destructive">
          Unable to refresh performance history. Showing saved data.
        </p>
      )}
    </>
  );
}
