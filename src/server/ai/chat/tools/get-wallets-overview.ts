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
      const needsFxRate = wallets.some(
        (wallet) => wallet.currency !== displayCurrency,
      );
      const fxRate = needsFxRate
        ? await QUERIES.getFxRateBefore(new Date())
        : null;

      if (needsFxRate && !fxRate) {
        return {
          status: "exchange-rate-unavailable",
          message:
            "Nie można przeliczyć Portfolio z powodu braku zapisanego kursu USD/PLN.",
        };
      }

      return buildWalletsOverview(wallets, displayCurrency, fxRate);
    },
  });
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
