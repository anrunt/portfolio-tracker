import type { SupportedCurrency } from "@/domain/currency";
import { QUERIES } from "@/server/db/queries";
import { tool } from "ai";
import { z } from "zod";
import type { ChatToolContext } from "./types";

export const getWalletsOverviewDefinition = {
  description: `Pobiera informacje portfeli użytkownika takie jak nazwa, waluta, całkowita wartość, zainwestowana wartość, Profil/Loss oraz informacje o całym portfolio użytkownika.
      Dane mogą być opóźnione o około 15 minut.
      Narzędzie nie zwraca listy pozycji ani historii transakcji.`,
  inputSchema: z.object({}),
};

export function createGetWalletsOverviewTool({ userId }: ChatToolContext) {
  return tool({
    description: getWalletsOverviewDefinition.description,
    inputSchema: getWalletsOverviewDefinition.inputSchema,
    execute: async () => {
      const [wallets, userPreferences] = await Promise.all([
        QUERIES.getWalletsWithLatestSnapshot(userId),
        QUERIES.getUserDisplayCurrency(userId),
      ]);

      if (wallets.length === 0) {
        return {
          status: "no-wallets",
          message: "Użytkownik nie posiada żadnych Walletów.",
        };
      }

      if (!userPreferences) {
        return {
          status: "display-currency-unavailable",
          message: "Nie można ustalić waluty prezentacji Portfolio.",
        };
      }

      const displayCurrency = userPreferences.displayCurrency;
      const portfolioWallets = await QUERIES.getWalletsWithLatestSnapshot(
        userId,
        displayCurrency,
      );

      return buildWalletsOverview(wallets, portfolioWallets, displayCurrency);
    },
  });
}

function buildWalletsOverview(
  wallets: Awaited<ReturnType<typeof QUERIES.getWalletsWithLatestSnapshot>>,
  portfolioWallets: Awaited<ReturnType<typeof QUERIES.getWalletsWithLatestSnapshot>>,
  displayCurrency: SupportedCurrency,
) {
  const walletsOverview = wallets.map((wallet) => {
    if (wallet.totalValue === null || wallet.netInvested === null) {
      throw new Error(`No native valuation for ${wallet.name}`);
    }

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

  const portfolioTotals = { totalValue: 0, netInvested: 0 };
  let hasMissingValuations = portfolioWallets.length === 0;
  let hasIncompleteMarketData = false;

  for (const wallet of portfolioWallets) {
    if (wallet.totalValue === null || wallet.netInvested === null) {
      hasMissingValuations = true;
      break;
    }

    portfolioTotals.totalValue += wallet.totalValue;
    portfolioTotals.netInvested += wallet.netInvested;

    if (wallet.valueSource === "cost-basis") {
      hasIncompleteMarketData = true;
    }
  }

  const valuationUnavailableReason = hasMissingValuations
    ? "Complete portfolio valuation is unavailable in the selected currency; partial totals are not provided."
    : null;

  let profitLossUnavailableReason = valuationUnavailableReason;
  if (!hasMissingValuations && hasIncompleteMarketData) {
    profitLossUnavailableReason =
      "Portfolio P/L is unavailable because at least one wallet lacks current market data.";
  }

  return {
    portfolio: {
      currency: displayCurrency,
      totalValue: hasMissingValuations ? null : portfolioTotals.totalValue,
      netInvested: hasMissingValuations ? null : portfolioTotals.netInvested,
      valuationUnavailableReason,
      profitLoss: hasMissingValuations || hasIncompleteMarketData
        ? null
        : portfolioTotals.totalValue - portfolioTotals.netInvested,
      profitLossUnavailableReason,
    },
    wallets: walletsOverview,
  };
}
