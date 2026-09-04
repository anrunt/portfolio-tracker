"use server";

import { Result, type SerializedResult } from "better-result";

import type { SupportedCurrency } from "@/domain/currency";
import { getSession } from "../../better-auth/session";
import { QUERIES } from "../../db/queries";
import {
  NotFoundError,
  UnauthenticatedError,
  UnauthorizedError,
  ValidationError,
  type WalletChartError,
} from "../../errors";
import {
  getPortfolioPerformanceHistory,
  getWalletPerformanceHistory,
  type PerformanceHistoryPeriod,
  type PerformanceHistoryPoint,
} from "../../services/performance-history";
import type { ChartDataPoint, SerializedError, TimeRange } from "../types";

export async function getWalletChartData(
  walletId: string,
  range: TimeRange,
): Promise<SerializedResult<ChartDataPoint[], SerializedError>> {
  const result = await getWalletChartDataResult(walletId, range);
  return Result.serialize(
    result.mapError((error) => error.toJSON() as SerializedError),
  );
}

async function getWalletChartDataResult(
  walletId: string,
  range: TimeRange,
): Promise<Result<ChartDataPoint[], WalletChartError>> {
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    const wallet = await QUERIES.getWalletById(
      walletId,
      user.session.userId,
    );
    if (!wallet) {
      return Result.err(
        new UnauthorizedError({ resource: `wallet ${walletId}` }),
      );
    }

    const period = mapTimeRange(range);
    if (!period) {
      return Result.err(
        new ValidationError({
          field: "range",
          message: "Unsupported time range for chart data",
        }),
      );
    }

    const now = new Date();
    const history = await getWalletPerformanceHistory({
      walletId,
      period,
      now,
    });

    return Result.ok(toChartDataPoints(history.points, period));
  });
}

export async function getAllWalletsPortfolioData(
  range: TimeRange,
  displayCurrency: SupportedCurrency,
): Promise<SerializedResult<ChartDataPoint[], SerializedError>> {
  void displayCurrency;
  const result = await getAllWalletsPortfolioDataResult(range);
  return Result.serialize(
    result.mapError((error) => error.toJSON() as SerializedError),
  );
}

async function getAllWalletsPortfolioDataResult(
  range: TimeRange,
): Promise<Result<ChartDataPoint[], WalletChartError>> {
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    const period = mapTimeRange(range);
    if (!period) {
      return Result.err(
        new ValidationError({
          field: "range",
          message: "Unsupported time range for chart data",
        }),
      );
    }

    const now = new Date();
    const result = await getPortfolioPerformanceHistory({
      userId: user.session.userId,
      period,
      now,
    });

    if (result.status === "failed") {
      const resource =
        result.error === "display-currency-unavailable"
          ? "User displayCurrency"
          : "Fx rate";

      return Result.err(new NotFoundError({ resource }));
    }

    return Result.ok(toChartDataPoints(result.history.points, period));
  });
}

function mapTimeRange(range: TimeRange): PerformanceHistoryPeriod | null {
  const periodsByRange: Record<TimeRange, PerformanceHistoryPeriod> = {
    "1D": "today",
    "1W": "week",
    "1M": "month",
    "3M": "three_months",
    "6M": "six_months",
    "1YR": "year",
  };

  return periodsByRange[range] ?? null;
}

function toChartDataPoints(
  points: PerformanceHistoryPoint[],
  period: PerformanceHistoryPeriod,
): ChartDataPoint[] {
  return points.map((point) => ({
    timestamp: new Date(point.at).getTime(),
    ...(period === "today" ? {} : { label: point.at }),
    totalValue: point.totalValue,
    netInvested: point.netInvested,
  }));
}
