import type { SupportedCurrency } from "@/domain/currency";
import { QUERIES } from "@/server/db/queries";
import { getPrices } from "@/server/services/market-data/get-prices";
import type { MarketPrice } from "@/server/services/market-data/types";
import { tool } from "ai";
import { z } from "zod";
import type { ChatToolContext } from "./types";

type UserWalletPositionRow = Awaited<
  ReturnType<typeof QUERIES.getUserWalletsWithPositions>
>[number];

type PositionToAggregate = {
  companyName: string;
  companySymbol: string;
  pricePerShare: number;
  quantity: number;
};

type AggregatedWalletPosition = {
  symbol: string;
  companyName: string;
  quantity: number;
  averagePurchasePrice: number;
  costBasis: number;
};

type PriceCoverage = "complete" | "partial" | "unavailable";

type GetHoldingsAnalysisOutput =
  | {
      status: "no-wallets";
      message: string;
    }
  | {
      status: "success";
      priceCoverage: PriceCoverage;
      unavailableSymbols: string[];
      wallets: AnalyzedWallet[];
    }
  | {
      status: "failed";
      error:
        | "display-currency-unavailable"
        | "market-prices-unavailable"
        | "exchange-rate-unavailable";
      message: string;
    };

type AnalyzedWallet = {
  name: string;
  currency: SupportedCurrency;
  positions: AnalyzedHolding[];
};

type AnalyzedHolding = {
  symbol: string;
  companyName: string;
  quantity: number;
  averagePurchasePrice: number;
  costBasis: number;
  marketData:
    | {
        status: "available";
        marketPrice: number;
        currentValue: number;
        unrealizedPl: number;
        unrealizedPlPercent: number | null;
        portfolioWeightPercent: number | null;
        fetchedAt: string;
      }
    | {
        status: "unavailable";
      };
};

export const getHoldingsAnalysisDefinition = {
  description:
    "Pobiera pozycje ze wszystkich portfeli użytkownika oraz oblicza ich wagi w całym Portfolio.",
  inputSchema: z.object({}),
};

export function createGetHoldingsAnalysisTool({ userId }: ChatToolContext) {
  return tool({
    description: getHoldingsAnalysisDefinition.description,
    inputSchema: getHoldingsAnalysisDefinition.inputSchema,
    execute: async () => {
      const operationId = crypto.randomUUID();
      let priceCoverage: PriceCoverage = "complete";

      const [positionsWithWallets, userPreferences] = await Promise.all([
        QUERIES.getUserWalletsWithPositions(userId),
        QUERIES.getUserDisplayCurrency(userId),
      ]);

      if (positionsWithWallets.length === 0) {
        return {
          status: "no-wallets",
          message: "Użytkownik nie posiada żadnych Walletów.",
        } satisfies GetHoldingsAnalysisOutput;
      }

      if (!userPreferences) {
        return {
          status: "failed",
          error: "display-currency-unavailable",
          message: "Nie można ustalić preferowanej waluty użytkownika.",
        } satisfies GetHoldingsAnalysisOutput;
      }

      const wallets = groupWalletPositions(positionsWithWallets);
      const US_Symbols = new Set<string>();
      const WA_Symbols = new Set<string>();

      for (const wallet of wallets) {
        const symbols = wallet.currency === "USD" ? US_Symbols : WA_Symbols;

        for (const position of wallet.positions) {
          symbols.add(position.symbol);
        }
      }

      const [usResult, waResult] = await Promise.all([
        getPrices({
          symbols: [...US_Symbols],
          exchange: "US",
          mode: "user-refresh",
          operationId,
        }),
        getPrices({
          symbols: [...WA_Symbols],
          exchange: "WA",
          mode: "user-refresh",
          operationId,
        }),
      ]);

      if (usResult.isErr() && waResult.isErr()) {
        console.error(
          "[chat/holdings-analysis] Finnhub fetch failed",
          usResult.error.message,
        );
        console.error(
          "[chat/holdings-analysis] Yahoo fetch failed",
          waResult.error.message,
        );
        return {
          status: "failed",
          error: "market-prices-unavailable",
          message: "Nie udało się pobrać danych rynkowych.",
        } satisfies GetHoldingsAnalysisOutput;
      }

      if (usResult.isErr()) {
        console.error(
          "[chat/holdings-analysis] Finnhub fetch failed",
          usResult.error.message,
        );
      }

      if (waResult.isErr()) {
        console.error(
          "[chat/holdings-analysis] Yahoo fetch failed",
          waResult.error.message,
        );
      }

      const usPrices = usResult.isErr() ? [] : usResult.value.prices;
      const waPrices = waResult.isErr() ? [] : waResult.value.prices;

      const usPricesBySymbol = new Map<string, MarketPrice>(
        usPrices.map((price) => [price.symbol, price]),
      );
      const waPricesBySymbol = new Map<string, MarketPrice>(
        waPrices.map((price) => [price.symbol, price]),
      );

      const missingUSPrices = [...US_Symbols].filter(
        (symbol) => !usPricesBySymbol.has(symbol),
      );
      const missingWAPrices = [...WA_Symbols].filter(
        (symbol) => !waPricesBySymbol.has(symbol),
      );
      const missingPricesCount =
        missingUSPrices.length + missingWAPrices.length;
      const unavailableSymbols = new Set([
        ...missingUSPrices,
        ...missingWAPrices,
      ]);
      const requestedPricesCount = US_Symbols.size + WA_Symbols.size;

      if (
        requestedPricesCount > 0 &&
        missingPricesCount === requestedPricesCount
      ) {
        priceCoverage = "unavailable";
      } else if (missingPricesCount > 0) {
        priceCoverage = "partial";
      }

      const holdingCurrencies = new Set(
        wallets
          .filter((wallet) => wallet.positions.length > 0)
          .map((wallet) => wallet.currency),
      );
      const shouldCalculatePortfolioWeights = priceCoverage === "complete";
      const needsFxRate =
        shouldCalculatePortfolioWeights && holdingCurrencies.size > 1;
      const fxRate = needsFxRate
        ? await QUERIES.getFxRateBefore(new Date())
        : null;

      if (needsFxRate && !fxRate) {
        return {
          status: "failed",
          error: "exchange-rate-unavailable",
          message:
            "Nie można przeliczyć wartości pozycji z powodu braku kursu USD/PLN.",
        } satisfies GetHoldingsAnalysisOutput;
      }

      let analyzedWallets: AnalyzedWallet[] = wallets.map((wallet) => ({
        name: wallet.name,
        currency: wallet.currency,
        positions: wallet.positions.map((position): AnalyzedHolding => {
          const pricesBySymbol =
            wallet.currency === "USD" ? usPricesBySymbol : waPricesBySymbol;
          const marketPrice = pricesBySymbol.get(position.symbol);

          if (!marketPrice) {
            return {
              ...position,
              marketData: { status: "unavailable" },
            };
          }

          const currentValue = position.quantity * marketPrice.price;
          const unrealizedPl = currentValue - position.costBasis;

          return {
            ...position,
            marketData: {
              status: "available",
              marketPrice: marketPrice.price,
              currentValue,
              unrealizedPl,
              unrealizedPlPercent:
                position.costBasis > 0
                  ? (unrealizedPl / position.costBasis) * 100
                  : null,
              portfolioWeightPercent: null,
              fetchedAt: marketPrice.fetchedAt,
            },
          };
        }),
      }));

      if (shouldCalculatePortfolioWeights) {
        let totalHoldingsValue = 0;

        for (const wallet of analyzedWallets) {
          for (const position of wallet.positions) {
            if (position.marketData.status === "unavailable") {
              throw new Error(
                "[chat/holdings-analysis] Complete price coverage contains an unavailable position",
              );
            }

            totalHoldingsValue += convertCurrency(
              position.marketData.currentValue,
              wallet.currency,
              userPreferences.displayCurrency,
              fxRate,
            );
          }
        }

        if (totalHoldingsValue > 0) {
          analyzedWallets = analyzedWallets.map((wallet) => ({
            ...wallet,
            positions: wallet.positions.map((position) => {
              if (position.marketData.status === "unavailable") {
                throw new Error(
                  "[chat/holdings-analysis] Complete price coverage contains an unavailable position",
                );
              }

              const currentValueInDisplayCurrency = convertCurrency(
                position.marketData.currentValue,
                wallet.currency,
                userPreferences.displayCurrency,
                fxRate,
              );

              return {
                ...position,
                marketData: {
                  ...position.marketData,
                  portfolioWeightPercent:
                    (currentValueInDisplayCurrency / totalHoldingsValue) * 100,
                },
              };
            }),
          }));
        }
      }

      return {
        status: "success",
        priceCoverage,
        unavailableSymbols: [...unavailableSymbols],
        wallets: analyzedWallets,
      } satisfies GetHoldingsAnalysisOutput;
    },
  });
}

function groupWalletPositions(rows: UserWalletPositionRow[]) {
  const groupedWallets = new Map<
    string,
    {
      name: string;
      currency: UserWalletPositionRow["wallet"]["currency"];
      positions: PositionToAggregate[];
    }
  >();

  for (const row of rows) {
    let groupedWallet = groupedWallets.get(row.wallet.id);

    if (!groupedWallet) {
      groupedWallet = {
        name: row.wallet.name,
        currency: row.wallet.currency,
        positions: [],
      };
      groupedWallets.set(row.wallet.id, groupedWallet);
    }

    if (row.position) {
      groupedWallet.positions.push(row.position);
    }
  }

  return Array.from(groupedWallets.values()).map((groupedWallet) => ({
    name: groupedWallet.name,
    currency: groupedWallet.currency,
    positions: aggregateWalletPositions(groupedWallet.positions),
  }));
}

function aggregateWalletPositions(
  positions: PositionToAggregate[],
): AggregatedWalletPosition[] {
  const grouped = new Map<
    string,
    {
      symbol: string;
      companyName: string;
      quantity: number;
      purchaseCost: number;
    }
  >();

  for (const position of positions) {
    const existing = grouped.get(position.companySymbol);

    if (existing) {
      existing.quantity += position.quantity;
      existing.purchaseCost += position.quantity * position.pricePerShare;
    } else {
      grouped.set(position.companySymbol, {
        symbol: position.companySymbol,
        companyName: position.companyName,
        quantity: position.quantity,
        purchaseCost: position.quantity * position.pricePerShare,
      });
    }
  }

  return Array.from(grouped.values()).map((group) => ({
    symbol: group.symbol,
    companyName: group.companyName,
    quantity: group.quantity,
    averagePurchasePrice: group.purchaseCost / group.quantity,
    costBasis: group.purchaseCost,
  }));
}

function convertCurrency(
  value: number,
  sourceCurrency: SupportedCurrency,
  targetCurrency: SupportedCurrency,
  fxRate: Awaited<ReturnType<typeof QUERIES.getFxRateBefore>> | null,
) {
  if (sourceCurrency === targetCurrency || !fxRate) {
    return value;
  }

  return sourceCurrency === fxRate.baseCurrency
    ? value * fxRate.rate
    : value / fxRate.rate;
}
