import { QUERIES } from "@/server/db/queries";
import type { MarketCurrency } from "@/server/services/market-data/types";

export type PerformanceHistoryPeriod =
  | "today"
  | "week"
  | "month"
  | "three_months"
  | "six_months"
  | "year";

export type PerformanceHistoryPoint = {
  at: string;
  totalValue: number;
  netInvested: number;
};

export type PerformanceHistorySummary = {
  startTotalValue: number;
  endTotalValue: number;
  totalValueChange: number;
  startNetInvested: number;
  endNetInvested: number;
  netInvestedChange: number;
  profitLossChange: number;
  highestValue: {
    value: number;
    at: string;
  };
  lowestValue: {
    value: number;
    at: string;
  };
};

export type PerformanceHistoryResult =
  | {
      status: "success";
      requestedPeriod: PerformanceHistoryPeriod;
      dataFrom: string;
      dataTo: string;
      summary: PerformanceHistorySummary;
      points: PerformanceHistoryPoint[];
    }
  | {
      status: "insufficient-history";
      requestedPeriod: PerformanceHistoryPeriod;
      availablePoints: number;
      dataFrom: string | null;
      dataTo: string | null;
      points: PerformanceHistoryPoint[];
    };

export type PortfolioPerformanceHistoryResult =
  | {
      status: "ready";
      currency: MarketCurrency;
      history: PerformanceHistoryResult;
    }
  | {
      status: "failed";
      error:
        | "display-currency-unavailable"
        | "exchange-rate-unavailable";
    };

export async function getWalletPerformanceHistory({
  walletId,
  period,
  now,
}: {
  walletId: string;
  period: PerformanceHistoryPeriod;
  now: Date;
}): Promise<PerformanceHistoryResult> {
  const start = getPeriodStart(period, now);

  if (period === "today") {
    const rows = await QUERIES.getIntradayPortfolioData(walletId, start);
    const points = rows.map((row) => ({
      at: row.snapshotAt.toISOString(),
      totalValue: Number(row.totalValue),
      netInvested: Number(row.netInvested),
    }));

    return analyzePerformanceHistory(points, period);
  }

  const rows = await QUERIES.getDailyPortfolioData(walletId, toDateKey(start));
  const points = rows.map((row) => ({
    at: row.snapshotDate,
    totalValue: Number(row.totalValue),
    netInvested: Number(row.netInvested),
  }));

  return analyzePerformanceHistory(points, period);
}

export async function getPortfolioPerformanceHistory({
  userId,
  period,
  now,
}: {
  userId: string;
  period: PerformanceHistoryPeriod;
  now: Date;
}): Promise<PortfolioPerformanceHistoryResult> {
  const start = getPeriodStart(period, now);
  const preferences = await QUERIES.getUserDisplayCurrency(userId);

  if (!preferences) {
    return {
      status: "failed",
      error: "display-currency-unavailable",
    };
  }

  const currency = preferences.displayCurrency;
  const history =
    period === "today"
      ? await getIntradayPortfolioHistory(userId, start, currency)
      : await getDailyPortfolioHistory(userId, start, now, currency);

  if (history === null) {
    return {
      status: "failed",
      error: "exchange-rate-unavailable",
    };
  }

  return {
    status: "ready",
    currency,
    history: analyzePerformanceHistory(history, period),
  };
}

async function getIntradayPortfolioHistory(
  userId: string,
  startOfToday: Date,
  displayCurrency: MarketCurrency,
): Promise<PerformanceHistoryPoint[] | null> {
  const rows = await QUERIES.getAllWalletsIntradayPortfolioData(
    userId,
    startOfToday,
  );
  const needsFxRate = rows.some(
    (row) => row.walletCurrency !== displayCurrency,
  );
  const fxRate = needsFxRate
    ? await QUERIES.getFxRateBefore(startOfToday)
    : null;

  if (needsFxRate && !fxRate) {
    return null;
  }

  const pointsByTimestamp = new Map<string, PerformanceHistoryPoint>();

  for (const row of rows) {
    const at = row.snapshotAt.toISOString();
    const converted = convertSnapshotValues(
      Number(row.totalValue),
      Number(row.netInvested),
      row.walletCurrency,
      displayCurrency,
      fxRate,
    );

    if (!converted) {
      return null;
    }

    addToPoint(pointsByTimestamp, at, converted);
  }

  return [...pointsByTimestamp.values()];
}

async function getDailyPortfolioHistory(
  userId: string,
  start: Date,
  now: Date,
  displayCurrency: MarketCurrency,
): Promise<PerformanceHistoryPoint[] | null> {
  const startDate = toDateKey(start);
  const rows = await QUERIES.getAllWalletsDailyPortfolioData(userId, startDate);
  const sortedRows = [...rows].sort((left, right) =>
    left.snapshotDate.localeCompare(right.snapshotDate),
  );
  const needsFxRates = sortedRows.some(
    (row) => row.walletCurrency !== displayCurrency,
  );

  const rates = needsFxRates
    ? await getHistoricalFxRates(start, now)
    : [];

  const pointsByDate = new Map<string, PerformanceHistoryPoint>();
  let currentRate: (typeof rates)[number] | null = null;
  let rateIndex = 0;

  for (const row of sortedRows) {
    while (
      rateIndex < rates.length &&
      rates[rateIndex].date <= row.snapshotDate
    ) {
      currentRate = rates[rateIndex];
      rateIndex += 1;
    }

    const converted = convertSnapshotValues(
      Number(row.totalValue),
      Number(row.netInvested),
      row.walletCurrency,
      displayCurrency,
      currentRate?.rate ?? null,
    );

    if (!converted) {
      return null;
    }

    addToPoint(pointsByDate, row.snapshotDate, converted);
  }

  return [...pointsByDate.values()];
}

async function getHistoricalFxRates(start: Date, now: Date) {
  const [ratesInRange, fallbackRate] = await Promise.all([
    QUERIES.getFxRatesInRange(start, now),
    QUERIES.getFxRateBefore(start),
  ]);

  return [
    ...(fallbackRate ? [fallbackRate] : []),
    ...ratesInRange,
  ]
    .sort((left, right) => left.asOf.getTime() - right.asOf.getTime())
    .map((rate) => ({
      date: toDateKey(rate.asOf),
      rate,
    }));
}

function convertSnapshotValues(
  totalValue: number,
  netInvested: number,
  sourceCurrency: MarketCurrency,
  targetCurrency: MarketCurrency,
  fxRate: Awaited<ReturnType<typeof QUERIES.getFxRateBefore>> | null,
) {
  if (sourceCurrency === targetCurrency) {
    return { totalValue, netInvested };
  }

  if (!fxRate) {
    return null;
  }

  if (
    sourceCurrency === fxRate.baseCurrency &&
    targetCurrency === fxRate.quoteCurrency
  ) {
    return {
      totalValue: totalValue * fxRate.rate,
      netInvested: netInvested * fxRate.rate,
    };
  }

  if (
    sourceCurrency === fxRate.quoteCurrency &&
    targetCurrency === fxRate.baseCurrency
  ) {
    return {
      totalValue: totalValue / fxRate.rate,
      netInvested: netInvested / fxRate.rate,
    };
  }

  return null;
}

function addToPoint(
  points: Map<string, PerformanceHistoryPoint>,
  at: string,
  values: { totalValue: number; netInvested: number },
) {
  const existing = points.get(at);

  if (existing) {
    existing.totalValue += values.totalValue;
    existing.netInvested += values.netInvested;
    return;
  }

  points.set(at, { at, ...values });
}

function analyzePerformanceHistory(
  unsortedPoints: PerformanceHistoryPoint[],
  requestedPeriod: PerformanceHistoryPeriod,
): PerformanceHistoryResult {
  const points = [...unsortedPoints].sort((left, right) =>
    left.at.localeCompare(right.at),
  );
  const firstPoint = points[0] ?? null;
  const lastPoint = points.at(-1) ?? null;

  if (!firstPoint || !lastPoint || points.length < 2) {
    return {
      status: "insufficient-history",
      requestedPeriod,
      availablePoints: points.length,
      dataFrom: firstPoint?.at ?? null,
      dataTo: lastPoint?.at ?? null,
      points,
    };
  }

  let highestPoint = firstPoint;
  let lowestPoint = firstPoint;

  for (const point of points.slice(1)) {
    if (point.totalValue > highestPoint.totalValue) {
      highestPoint = point;
    }

    if (point.totalValue < lowestPoint.totalValue) {
      lowestPoint = point;
    }
  }

  const totalValueChange = lastPoint.totalValue - firstPoint.totalValue;
  const netInvestedChange =
    lastPoint.netInvested - firstPoint.netInvested;

  return {
    status: "success",
    requestedPeriod,
    dataFrom: firstPoint.at,
    dataTo: lastPoint.at,
    summary: {
      startTotalValue: firstPoint.totalValue,
      endTotalValue: lastPoint.totalValue,
      totalValueChange,
      startNetInvested: firstPoint.netInvested,
      endNetInvested: lastPoint.netInvested,
      netInvestedChange,
      profitLossChange: totalValueChange - netInvestedChange,
      highestValue: {
        value: highestPoint.totalValue,
        at: highestPoint.at,
      },
      lowestValue: {
        value: lowestPoint.totalValue,
        at: lowestPoint.at,
      },
    },
    points,
  };
}

function getPeriodStart(period: PerformanceHistoryPeriod, now: Date) {
  if (period === "today") {
    const start = new Date(now);
    start.setUTCHours(0, 0, 0, 0);
    return start;
  }

  if (period === "week") {
    const start = new Date(now);
    start.setUTCDate(start.getUTCDate() - 7);
    return start;
  }

  const monthsByPeriod = {
    month: 1,
    three_months: 3,
    six_months: 6,
    year: 12,
  } as const;
  const start = new Date(now);
  const originalDay = start.getUTCDate();

  start.setUTCDate(1);
  start.setUTCMonth(start.getUTCMonth() - monthsByPeriod[period]);

  const daysInTargetMonth = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0),
  ).getUTCDate();

  start.setUTCDate(Math.min(originalDay, daysInTargetMonth));
  return start;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
