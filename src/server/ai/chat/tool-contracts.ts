import { generateText } from "ai";
import { z } from "zod";

export const CHAT_TOOL_CONTRACTS = {
  getWalletsOverview: {
    description: `Pobiera informacje portfeli użytkownika takie jak nazwa, waluta, całkowita wartość, zainwestowana wartość, Profil/Loss oraz informacje o całym portfolio użytkownika.
      Dane mogą być opóźnione o około 15 minut.
      Narzędzie nie zwraca listy pozycji ani historii transakcji.`,
    inputSchema: z.object({}),
  },
  getHoldingsAnalysis: {
    description:
      "Pobiera pozycje ze wszystkich portfeli użytkownika oraz oblicza ich wagi w całym Portfolio.",
    inputSchema: z.object({}),
  },
  getTransactionHistory: {
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
  },
};
