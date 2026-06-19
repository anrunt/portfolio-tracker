"use server";

import { Result, type SerializedResult } from "better-result";

import { getSession } from "../../better-auth/session";
import { QUERIES } from "../../db/queries";
import {
  NotFoundError,
  UnauthenticatedError,
  UnauthorizedError,
  ValidationError,
  type WalletChartError,
} from "../../errors";
import type { ChartDataPoint, SerializedError, TimeRange } from "../types";

export async function getWalletChartData(walletId: string, range: TimeRange): Promise<SerializedResult<ChartDataPoint[], SerializedError>> {
  const result = await getWalletChartDataResult(walletId, range);
  return Result.serialize(result.mapError((e) => e.toJSON() as SerializedError));
}

async function getWalletChartDataResult(walletId: string, range: TimeRange): Promise<Result<ChartDataPoint[], WalletChartError>> {
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    const isUserWallet = await QUERIES.getWalletById(walletId, user.session.userId);
    if (!isUserWallet) {
      return Result.err(new UnauthorizedError({ resource: `wallet ${walletId}` }))
    }

    if (range === "1D") {
      const start = new Date();
      start.setUTCHours(0,0,0,0);

      const intradayDataRaw = await QUERIES.getIntradayPortfolioData(walletId, start);
      if (!intradayDataRaw) {
        return Result.err(new NotFoundError({resource: "Wallet Snapshots", id: walletId}));
      }

      const intradayData = intradayDataRaw.map((r) => ({
        timestamp: r.snapshotAt.getTime(),
        totalValue: Number(r.totalValue),
        totalCostBasis: Number(r.totalCostBasis),
      }));

      return Result.ok(intradayData);
    } else if (["1W", "1M", "3M", "6M", "1YR"].includes(range)) {
      const start = new Date();

      switch (range) {
        case "1W":
          start.setDate(start.getDate() - 7);
          break;
        case "1M":
          start.setMonth(start.getMonth() - 1);
          break;
        case "3M":
          start.setMonth(start.getMonth() - 3);
          break;
        case "6M":
          start.setMonth(start.getMonth() - 6);
          break;
        case "1YR":
          start.setFullYear(start.getFullYear() - 1);
          break;
      }

      const startDateStr = start.toISOString().split("T")[0];
      const dailyDataRaw = await QUERIES.getDailyPortfolioData(walletId, startDateStr);
      if (!dailyDataRaw) {
        return Result.err(new NotFoundError({resource: "Wallet Snapshots", id: walletId}));
      }

      const dailyData = dailyDataRaw.map((r) => ({
        timestamp: new Date(r.snapshotDate).getTime(),
        label: r.snapshotDate,
        totalValue: Number(r.totalValue),
        totalCostBasis: Number(r.totalCostBasis),
      }))

      return Result.ok(dailyData);
    } else {
      return Result.err(new ValidationError({ field: "range", message: "Unsupported time range for chart data" }));
    }
  })
}

export async function getAllWalletsPortfolioData(range: TimeRange, displayCurrency: "PLN" | "USD"): Promise<SerializedResult<ChartDataPoint[], SerializedError>> {
  const result = await getAllWalletsPortfolioDataResult(range, displayCurrency);
  return Result.serialize(result.mapError((e) => e.toJSON() as SerializedError));
}

async function getAllWalletsPortfolioDataResult(range: TimeRange, displayCurrency: "PLN" | "USD"): Promise<Result<ChartDataPoint[], WalletChartError>>{
  return Result.gen(async function* () {
    const user = await getSession();
    if (!user) {
      return Result.err(new UnauthenticatedError());
    }

    if (range === "1D") {
      const start = new Date();
      start.setUTCHours(0,0,0,0);

      const intradayPortfolioDataRaw = await QUERIES.getAllWalletsIntradayPortfolioData(user.session.userId, start);
      if (!intradayPortfolioDataRaw) {
        return Result.err(new NotFoundError({resource: "Wallet Snapshots"}));
      }

      const needsFxRates = intradayPortfolioDataRaw.some(
        (r) => r.walletCurrency !== displayCurrency
      );
      let fxRate: number | null = null;

      if (needsFxRates) {
        const fx = await QUERIES.getFxRateBefore(start);

        if (!fx) {
          return Result.err(new NotFoundError({resource: "Fx rate"}));
        }

        fxRate = fx.rate;
      }

      const byTimestamp = new Map<number, {timestamp: number, totalValue: number, totalCostBasis:number}>();

      for (const r of intradayPortfolioDataRaw) {
        const timestamp = r.snapshotAt.getTime();

        let totalValue = Number(r.totalValue);
        let totalCostBasis = Number(r.totalCostBasis);

        if (r.walletCurrency !== displayCurrency) {
          if (fxRate === null) {
            return Result.err(new NotFoundError({resource: "Fx rate"}));
          }

          if (r.walletCurrency === "USD") {
            totalValue = totalValue * fxRate;
            totalCostBasis = totalCostBasis * fxRate;
          } else {
            totalValue = totalValue / fxRate;
            totalCostBasis = totalCostBasis / fxRate;
          }
        }

        const existingPoint = byTimestamp.get(timestamp);

        if (existingPoint) {
          existingPoint.totalValue += totalValue;
          existingPoint.totalCostBasis += totalCostBasis;
        } else {
          byTimestamp.set(timestamp, {
            timestamp,
            totalValue,
            totalCostBasis,
          });
        }
      }

      const intradayData = Array.from(byTimestamp.values()).sort(
        (a, b) => a.timestamp - b.timestamp
      );

      return Result.ok(intradayData);
    } else if (["1W", "1M", "3M", "6M", "1YR"].includes(range)) {
      const startDate = new Date();
      const currentDate = new Date();

      switch (range) {
        case "1W":
          startDate.setDate(startDate.getDate() - 7);
          break;
        case "1M":
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case "3M":
          startDate.setMonth(startDate.getMonth() - 3);
          break;
        case "6M":
          startDate.setMonth(startDate.getMonth() - 6);
          break;
        case "1YR":
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      const startDateStr = startDate.toISOString().split("T")[0];
      const dailyPortfolioDataRaw = await QUERIES.getAllWalletsDailyPortfolioData(user.session.userId, startDateStr);
      if (!dailyPortfolioDataRaw) {
        return Result.err(new NotFoundError({resource: "Wallet Snapshots"}));
      }

      const displayCurrencyRaw = await QUERIES.getUserDisplayCurrency(user.session.userId);
      if (!displayCurrencyRaw) {
        return Result.err(new NotFoundError({resource: "User displayCurrency"}));
      }

      const displayCurrency = displayCurrencyRaw[0].displayCurrency;

      const needsFxRates = dailyPortfolioDataRaw.some(
        (data) => data.walletCurrency !== displayCurrency
      );

      type FxRateWithDateStr = Awaited<ReturnType<typeof QUERIES.getFxRatesInRange>>[number] & {
        dateStr: string;
      };

      let allRates: FxRateWithDateStr[] = [];
      if (needsFxRates) {
        const [ratesInRange, fallbackRate] = await Promise.all([
          QUERIES.getFxRatesInRange(startDate, currentDate),
          QUERIES.getFxRateBefore(startDate)
        ])

        allRates = [
          ...(fallbackRate ? [fallbackRate] : []),
          ...ratesInRange,
        ]
          .sort((a, b) => a.asOf.getTime() - b.asOf.getTime())
          .map((r) => ({ ...r, dateStr: r.asOf.toISOString().split("T")[0] }));

        if (allRates.length === 0) {
          return Result.err(new NotFoundError({resource: "No currency rates"}));
        }
      }

      const byDate = new Map<string, {
        timestamp: number,
        label: string,
        totalValue: number,
        totalCostBasis: number
      }>();

      let currentRate: typeof allRates[number] | null = null;
      let rateIdx = 0;
      for (const data of dailyPortfolioDataRaw) {
        const snapshotDate = data.snapshotDate;

        if (needsFxRates) {
          while (rateIdx < allRates.length && allRates[rateIdx].dateStr <= snapshotDate) {
            currentRate = allRates[rateIdx];
            rateIdx += 1;
          }

          if (currentRate == null) {
            currentRate = allRates[0];
          }
        }

        let totalValue = Number(data.totalValue);
        let totalCostBasis = Number(data.totalCostBasis);

        if (data.walletCurrency !== displayCurrency) {
          if (currentRate == null) {
            return Result.err(new NotFoundError({resource: "No currency rates"}));
          }

          if (data.walletCurrency === "USD") {
            totalValue = totalValue * currentRate.rate;
            totalCostBasis = totalCostBasis * currentRate.rate;
          } else {
            totalValue = totalValue / currentRate.rate;
            totalCostBasis = totalCostBasis / currentRate.rate;
          }
        }

        const existingPoint = byDate.get(snapshotDate);

        if (existingPoint) {
          existingPoint.totalValue += totalValue;
          existingPoint.totalCostBasis += totalCostBasis;
        } else {
          byDate.set(snapshotDate, {
            timestamp: new Date(snapshotDate).getTime(),
            label: snapshotDate,
            totalValue,
            totalCostBasis,
          });
        }
      }

      const dailyData = Array.from(byDate.values()).sort(
        (a, b) => a.timestamp - b.timestamp
      );

      return Result.ok(dailyData);
    } else {
      return Result.err(new ValidationError({ field: "range", message: "Unsupported time range for chart data" }));
    }
  })
}
