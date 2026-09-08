import { QUERIES } from "@/server/db/queries";
import { tool } from "ai";
import { z } from "zod";
import type { ChatToolContext } from "./types";

export const getTransactionHistoryDefinition = {
  description: `
      Pobiera historie transakcji kupna i sprzedaży wskazanej spółki z wybranego portfela użytkownika
      - Jeżeli użytkownik wyraźnie prosi o wszystkie portfele, ustaw zakres all
      - Jeżeli użytkownik prosi o konkretny portfel lub portfele ustaw zakres specified
      - Jeżeli nie wiadomo czy prosi o wszystkie portfele ustaw zakres unspecified
      - Proś o wybór portfela wyłącznie po otrzymaniu wallet-selection-required
    `,
  inputSchema: z.discriminatedUnion("walletScope", [
    z.object({
      companyNameOrSymbol: z.string().describe("Symbol albo nazwa spółki"),
      walletScope: z.literal("all"),
      walletNames: z.array(z.string()).optional(),
    }),
    z.object({
      companyNameOrSymbol: z.string().describe("Symbol albo nazwa spółki"),
      walletScope: z.literal("specified"),
      walletNames: z
        .array(z.string())
        .min(1)
        .describe("Nazwy portfeli podane przez użytkownika"),
    }),
    z.object({
      companyNameOrSymbol: z.string().describe("Symbol albo nazwa spółki"),
      walletScope: z.literal("unspecified"),
      walletNames: z.array(z.string()).optional(),
    }),
  ]),
};

export function createGetTransactionHistoryTool({ userId }: ChatToolContext) {
  return tool({
    description: getTransactionHistoryDefinition.description,
    inputSchema: getTransactionHistoryDefinition.inputSchema,
    execute: async ({ companyNameOrSymbol, walletScope, walletNames }) => {
      if (walletScope === "specified") {
        const lowerWalletNames = walletNames.map((name) => name.toLowerCase());
        const transactionHistory = await QUERIES.getUserTransactionHistory(
          userId,
          companyNameOrSymbol,
          lowerWalletNames,
        );
        const groupedTransactionHistory =
          groupTransactionHistory(transactionHistory);

        if (groupedTransactionHistory.length === 0) {
          return { status: "transaction-not-found" };
        }

        return {
          status: "success",
          transactionHistory: groupedTransactionHistory,
        };
      }

      const transactionHistory = await QUERIES.getUserTransactionHistory(
        userId,
        companyNameOrSymbol,
      );
      const groupedTransactionHistory =
        groupTransactionHistory(transactionHistory);

      if (groupedTransactionHistory.length === 0) {
        return { status: "transaction-not-found" };
      }

      if (walletScope === "all" || groupedTransactionHistory.length === 1) {
        return {
          status: "success",
          transactionHistory: groupedTransactionHistory,
        };
      }

      return {
        status: "wallet-selection-required",
        wallets: groupedTransactionHistory,
      };
    },
  });
}

function groupTransactionHistory(
  transactionHistory: Awaited<
    ReturnType<typeof QUERIES.getUserTransactionHistory>
  >,
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
