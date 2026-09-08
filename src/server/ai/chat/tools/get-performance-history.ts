import type { SupportedCurrency } from "@/domain/currency";
import { QUERIES } from "@/server/db/queries";
import {
  getPortfolioPerformanceHistory,
  getWalletPerformanceHistory,
  type PerformanceHistoryPeriod,
  type PerformanceHistoryPoint,
  type PerformanceHistoryResult,
  type PerformanceHistorySummary,
} from "@/server/services/performance-history";
import { tool } from "ai";
import { z } from "zod";
import type { ChatToolContext } from "./types";

const performanceHistoryPeriodSchema = z.enum([
  "today",
  "week",
  "month",
  "three_months",
  "six_months",
  "year",
]);

export const getPerformanceHistoryDefinition = {
  description: `Analizuje zmianę wartości całego Portfolio albo jednego Walleta na podstawie zapisanych snapshotów.
    Używaj dla pytań o zmianę wartości, zarobek po uwzględnieniu wpłat i wypłat, najwyższą lub najniższą wartość oraz porównanie danych w czasie.
    Jawne pytanie o Portfolio ma walletScope portfolio. Jawne pytanie o konkretny Wallet ma walletScope wallet i jego nazwę. Gdy użytkownik nie wskazuje Walleta, domyślnie wybierz Portfolio.
    Nie używaj tego narzędzia do pytań wyłącznie o bieżącą wartość.
    Gdy wynik ma status wallet-selection-required, zawiera gotową historię każdego pasującego Walleta. Po doprecyzowaniu przez użytkownika korzystaj z tego wyniku i nie wywołuj narzędzia ponownie.
    W kwesti waluty dla wallet-selection-required, użyj waluty z pytania do wybrania gotowej historii; jeśli nadal nie ma jednoznacznego wyboru, poproś o doprecyzowanie.`,
  inputSchema: z.discriminatedUnion("walletScope", [
    z.object({
      walletScope: z.literal("portfolio"),
      period: performanceHistoryPeriodSchema,
    }),
    z.object({
      walletScope: z.literal("wallet"),
      walletName: z
        .string()
        .min(2)
        .describe("Nazwa Walleta podana przez użytkownika"),
      period: performanceHistoryPeriodSchema,
    }),
  ]),
};

type PerformanceHistoryScope =
  | {
      type: "portfolio";
      currency: SupportedCurrency;
    }
  | {
      type: "wallet";
      name: string;
      currency: SupportedCurrency;
    };

type ModelPerformanceHistory =
  | {
      status: "success";
      scope: PerformanceHistoryScope;
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
    };

type PerformanceHistoryToolOutput =
  | ModelPerformanceHistory
  | {
      status: "wallet-not-found";
      wallets: Array<{
        name: string;
        currency: SupportedCurrency;
      }>;
    }
  | {
      status: "wallet-selection-required";
      wallets: Array<{
        name: string;
        currency: SupportedCurrency;
        history: ModelPerformanceHistory;
      }>;
    }
  | {
      status: "failed";
      error:
        | "display-currency-unavailable"
    };

export function createGetPerformanceHistoryTool({ userId }: ChatToolContext) {
  return tool({
    description: getPerformanceHistoryDefinition.description,
    inputSchema: getPerformanceHistoryDefinition.inputSchema,
    execute: async (input) => {
      const now = new Date();

      if (input.walletScope === "portfolio") {
        const result = await getPortfolioPerformanceHistory({
          userId,
          period: input.period,
          now,
        });

        if (result.status === "failed") {
          return result;
        }

        const scope: PerformanceHistoryScope = {
          type: "portfolio",
          currency: result.currency,
        };

        return formatHistoryForToolOutput(result.history, scope);
      }

      return getWalletHistoryByName(
        userId,
        input.walletName,
        input.period,
        now,
      );
    },
  });
}

async function getWalletHistoryByName(
  userId: string,
  walletName: string,
  period: PerformanceHistoryPeriod,
  now: Date,
): Promise<PerformanceHistoryToolOutput> {
  const wallets = await QUERIES.getWallets(userId);
  const normalizedWalletName = walletName.toLowerCase();
  const matchingWallets = wallets.filter(
    (wallet) => wallet.name.toLowerCase() === normalizedWalletName,
  );

  if (matchingWallets.length === 0) {
    return {
      status: "wallet-not-found",
      wallets: wallets.map((wallet) => ({
        name: wallet.name,
        currency: wallet.currency,
      })),
    };
  }

  if (matchingWallets.length === 1) {
    const wallet = matchingWallets[0];
    const result = await getWalletPerformanceHistory({
      walletId: wallet.id,
      walletCurrency: wallet.currency,
      period,
      now,
    });
    const scope: PerformanceHistoryScope = {
      type: "wallet",
      name: wallet.name,
      currency: wallet.currency,
    };

    return formatHistoryForToolOutput(result, scope);
  }

  const histories = await Promise.all(
    matchingWallets.map(async (wallet) => {
      const result = await getWalletPerformanceHistory({
        walletId: wallet.id,
        walletCurrency: wallet.currency,
        period,
        now,
      });
      const scope: PerformanceHistoryScope = {
        type: "wallet",
        name: wallet.name,
        currency: wallet.currency,
      };
      const history = formatHistoryForToolOutput(result, scope);

      return {
        name: wallet.name,
        currency: wallet.currency,
        history,
      };
    }),
  );

  return {
    status: "wallet-selection-required",
    wallets: histories,
  };
}

function formatHistoryForToolOutput(
  result: PerformanceHistoryResult,
  scope: PerformanceHistoryScope,
): ModelPerformanceHistory {
  if (result.status === "success") {
    return {
      ...result,
      scope,
    };
  }

  return {
    status: result.status,
    requestedPeriod: result.requestedPeriod,
    availablePoints: result.availablePoints,
    dataFrom: result.dataFrom,
    dataTo: result.dataTo,
  };
}
