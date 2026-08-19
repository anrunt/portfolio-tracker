import { groq } from "@/server/ai/groq";
import { CHAT_TOOL_CONTRACTS } from "@/server/ai/chat/tool-contracts";
import { GroqLanguageModelChatOptions } from "@ai-sdk/groq";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  UIMessage,
  validateUIMessages,
} from "ai";
import { getSession } from "@/server/better-auth/session";
import { QUERIES } from "@/server/db/queries";
import { getPrices } from "@/server/services/market-data/get-prices";
import type {
  MarketCurrency,
  MarketPrice,
} from "@/server/services/market-data/types";
import { buildSystemPrompt } from "@/server/ai/chat/system-prompt";

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
  currency: MarketCurrency;
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

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();
  const validatedMessages = await validateUIMessages({
    messages,
  });

  const result = streamText({
    model: groq("openai/gpt-oss-20b"),
    system: buildSystemPrompt(),
    providerOptions: {
      groq: {
        reasoningFormat: "hidden",
        reasoningEffort: "low",
      } satisfies GroqLanguageModelChatOptions,
    },
    stopWhen: isStepCount(10),
    tools: {
      getWalletsOverview: tool({
        ...CHAT_TOOL_CONTRACTS.getWalletsOverview,
        execute: async () => {
          const [wallets, userPreferences] = await Promise.all([
            QUERIES.getWalletsWithLatestSnapshot(session.user.id),
            QUERIES.getUserDisplayCurrency(session.user.id),
          ]);

          if (!userPreferences) {
            return {
              status: "display-currency-unavailable",
              message: "Nie można ustalić waluty prezentacji Portfolio.",
            };
          }

          const displayCurrency = userPreferences.displayCurrency;

          const needsFxRate = wallets.some(
            (wallet) => wallet.currency !== displayCurrency,
          );

          const fxRate = needsFxRate
            ? await QUERIES.getFxRateBefore(new Date())
            : null;

          if (needsFxRate && !fxRate) {
            return {
              status: "exchange-rate-unavailable",
              message: "Nie można przeliczyć Portfolio z powodu braku zapisanego kursu USD/PLN.",
            };
          }

          return buildWalletsOverview(wallets, displayCurrency, fxRate);
        },
      }),

      getHoldingsAnalysis: tool({
        ...CHAT_TOOL_CONTRACTS.getHoldingsAnalysis,
        execute: async () => {
          const operationId = crypto.randomUUID();
          let priceCoverage: PriceCoverage = "complete";

          const [positionsWithWallets, userPreferences] = await Promise.all([
            QUERIES.getUserWalletsWithPositions(session.user.id),
            QUERIES.getUserDisplayCurrency(session.user.id),
          ]);

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
            getPrices({ symbols: [...US_Symbols], exchange: "US", mode: "user-refresh", operationId }),
            getPrices({ symbols: [...WA_Symbols], exchange: "WA", mode: "user-refresh", operationId }),
          ]);

          if (usResult.isErr() && waResult.isErr()) {
            console.error("[chat/holdings-analysis] Finnhub fetch failed", usResult.error.message);
            console.error("[chat/holdings-analysis] Yahoo fetch failed", waResult.error.message);
            return {
              status: "failed",
              error: "market-prices-unavailable",
              message: "Nie udało się pobrać danych rynkowych.",
            } satisfies GetHoldingsAnalysisOutput;
          }

          if (usResult.isErr()) {
            console.error("[chat/holdings-analysis] Finnhub fetch failed", usResult.error.message);
          }

          if (waResult.isErr()) {
            console.error("[chat/holdings-analysis] Yahoo fetch failed", waResult.error.message);
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

          const missingPricesCount = missingUSPrices.length + missingWAPrices.length;

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

          const needsFxRate = shouldCalculatePortfolioWeights && holdingCurrencies.size > 1;

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
                wallet.currency === "USD"
                  ? usPricesBySymbol
                  : waPricesBySymbol;

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
      }),

      getTransactionHistory: tool({
        ...CHAT_TOOL_CONTRACTS.getTransactionHistory,
        execute: async ({ companyNameOrSymbol, walletScope, walletNames }) => {
          if (walletScope === "specified") {
            const lowerWalletNames = walletNames.map((name) => name.toLowerCase());

            const transactionHistory = await QUERIES.getUserTransactionHistory(
              session.user.id,
              companyNameOrSymbol,
              lowerWalletNames,
            );

            const groupedTransactionHistory = groupTransactionHistory(transactionHistory);

            if (groupedTransactionHistory.length === 0) {
              return { status: "transaction-not-found" };
            }
            return { status: "success", transactionHistory: groupedTransactionHistory };
          }

          const transactionHistory = await QUERIES.getUserTransactionHistory(
            session.user.id,
            companyNameOrSymbol,
          );

          const groupedTransactionHistory = groupTransactionHistory(transactionHistory);

          if (groupedTransactionHistory.length === 0) {
            return { status: "transaction-not-found" };
          }

          if (walletScope === "all" || groupedTransactionHistory.length === 1) {
            return { status: "success", transactionHistory: groupedTransactionHistory };
          }

          return {
            status: "wallet-selection-required",
            wallets: groupedTransactionHistory,
          };
        }
      })
    },
    onStepEnd: ({ toolResults }) => {
      console.log(toolResults);
    },
    messages: await convertToModelMessages(validatedMessages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
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

function groupTransactionHistory(
  transactionHistory: Awaited<
    ReturnType<typeof QUERIES.getUserTransactionHistory>
  >
) {
  const groupedWallets = new Map<
    string,
    {
      name: string;
      currency: (typeof transactionHistory)[number]["wallet"]["currency"];
      transactions: Array<
        Omit<
          (typeof transactionHistory)[number]["transaction"],
          "createdAt"
        > & { createdAt: string }
      >;
    }
  >();

  for (const row of transactionHistory) {
    let groupedWallet = groupedWallets.get(row.wallet.id);

    if (!groupedWallet) {
      groupedWallet = {
        name: row.wallet.name,
        currency: row.wallet.currency,
        transactions: [],
      };

      groupedWallets.set(row.wallet.id, groupedWallet);
    }

    groupedWallet.transactions.push({
      ...row.transaction,
      createdAt: row.transaction.createdAt.toISOString(),
    });
  }

  return Array.from(groupedWallets.values());
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
  sourceCurrency: MarketCurrency,
  targetCurrency: MarketCurrency,
  fxRate: Awaited<ReturnType<typeof QUERIES.getFxRateBefore>> | null,
) {
  if (sourceCurrency === targetCurrency || !fxRate) {
    return value;
  }

  return sourceCurrency === fxRate.baseCurrency
    ? value * fxRate.rate
    : value / fxRate.rate;
}

function buildWalletsOverview(
  wallets: Awaited<ReturnType<typeof QUERIES.getWalletsWithLatestSnapshot>>,
  displayCurrency: "USD" | "PLN",
  fxRate: Awaited<ReturnType<typeof QUERIES.getFxRateBefore>> | null,
) {
  const walletsOverview = wallets.map((wallet) => {
    const hasIncompleteMarketData = wallet.valueSource === "cost-basis";

    return {
      name: wallet.name,
      currency: wallet.currency,
      totalValue: wallet.totalValue,
      netInvested: wallet.netInvested,
      profitLoss: hasIncompleteMarketData
        ? null
        : wallet.totalValue - wallet.netInvested,
      profitLossUnavailableReason: hasIncompleteMarketData
        ? "Brak aktualnych danych rynkowych; wartość Walleta pochodzi z kosztu nabycia."
        : null,
      dataAsOf: wallet.snapshotAt?.toISOString() ?? null,
      valueSource: wallet.valueSource,
    };
  });

  const hasIncompleteMarketData = wallets.some(
    (wallet) => wallet.valueSource === "cost-basis",
  );
  const portfolioTotals = wallets.reduce(
    (totals, wallet) => {
      let totalValue = wallet.totalValue;
      let netInvested = wallet.netInvested;

      if (fxRate && wallet.currency !== displayCurrency) {
        if (wallet.currency === fxRate.baseCurrency) {
          totalValue *= fxRate.rate;
          netInvested *= fxRate.rate;
        } else {
          totalValue /= fxRate.rate;
          netInvested /= fxRate.rate;
        }
      }

      return {
        totalValue: totals.totalValue + totalValue,
        netInvested: totals.netInvested + netInvested,
      };
    },
    { totalValue: 0, netInvested: 0 },
  );

  return {
    portfolio: {
      currency: displayCurrency,
      totalValue: portfolioTotals.totalValue,
      netInvested: portfolioTotals.netInvested,
      profitLoss: hasIncompleteMarketData
        ? null
        : portfolioTotals.totalValue - portfolioTotals.netInvested,
      profitLossUnavailableReason: hasIncompleteMarketData
        ? "Nie można podać P/L całego Portfolio, ponieważ co najmniej jeden Wallet nie ma aktualnych danych rynkowych."
        : null,
    },
    wallets: walletsOverview,
  };
}
