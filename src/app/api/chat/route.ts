import { groq } from "@/server/ai/groq";
import { GroqLanguageModelChatOptions } from "@ai-sdk/groq";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  isStepCount,
  streamText,
  tool,
  toUIMessageStream,
  UIMessage,
} from "ai";
import { getSession } from "@/server/better-auth/session";
import { QUERIES } from "@/server/db/queries";
import z from "zod";

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
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

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
        description: `Pobiera informacje portfeli użytkownika takie jak id, nazwa, waluta, całkowita wartość, zainwestowana wartość.
          Dane mogą być opóźnione o około 15 minut. 
          Narzędzie nie zwraca listy pozycji ani historii transakcji.`,
        inputSchema: z.object({}),
        execute: async () => {
          const wallets = await QUERIES.getWalletsWithLatestSnapshot(
            session.user.id,
          );

          return wallets.map((wallet) => ({
            walletId: wallet.id,
            name: wallet.name,
            currency: wallet.currency,
            totalValue: wallet.totalValue,
            netInvested: wallet.netInvested,
            dataAsOf: wallet.snapshotAt?.toISOString() ?? null,
          }));
        },
      }),

      getAllWalletsPositions: tool({
        description: `Pobiera pozycje ze wszystkich portfeli użytkownika.`,
        inputSchema: z.object({}),
        execute: async () => {
          const positionsWithWallets = await QUERIES.getUserWalletsWithPositions(session.user.id);

          return {
            status: "success",
            wallets: groupWalletPositions(positionsWithWallets),
          };
        },
      }),

      getTransactionHistory: tool({
        description: "Pobiera historie transakcji kupna i sprzedaży wskazanej spółki z wybranego portfela użytkownika",
        inputSchema: z.object({
          companyNameOrSymbol: z.string().describe("Symbol albo nazwa spółki"),
          walletName: z.string().describe("Nazwa portfela").optional()
        }),
        execute: async ({companyNameOrSymbol, walletName}) => {


        }
      })
    },
    onStepEnd: ({ toolResults }) => {
      console.log(toolResults);
    },
    messages: await convertToModelMessages(messages),
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
  }));
}

function buildSystemPrompt() {
  const basePrompt = `
  - Jesteś asystentem analizującym portfel użytkownika.
  - Portfel - jeden portfel w którym użytkownik może trzymać akcje
  - Portfolio - grupa składająca się z wielu portfeli w których użytkownik może trzymać akcje
  - Używaj tylko narzędzi dostępnych w bieżącej rozmowie.
  - Nie ujawniaj technicznych nazw ani implementacji narzędzi, ale jasno
    komunikuj brak dostępu do danych.
  - Nigdy nie próbuj wywoływać nieudostępnionego narzędzia, jeżeli potrzebne dane nie są dostępne, nie zgaduj, poinformuj użytkownika, że aktualnie nie masz dostępu do danych portfela.
  - Nie sugeruj użytkownikowi co ma zrobić jeżeli ty nie masz dostępu do jakiś danych.
  - Kiedy mówisz z jakiego czasu pochodzą dane, używaj sformułowań typu "Dane pochodzą z dnia {data}". Nie pisz nic wiecej.
  - Nie pokazuj id portfela.
  - jesli prosisz użytkownika o doprecyzowanie pytaj się o walute lub nazwę w zależności od kontekstu, nie proś go o id, wypisz mu dostępne opcje
  - jeśli kilka portfeli jest w tej samej walucie, to tylko wtedy poproś o doprecyzowanie, następnie wywołaj getWalletPositions.
  - Ceny akcji podawaj w walucie portfela w którym te akcje się znajdują czyli jeżeli akcje znajdują się w portfelu z currency USD to akcje są w USD.
  - Przy każdym pytaniu o pozycje w portfelach, wywołaj getAllWalletsPositions
  `;

  return `${basePrompt}`;
}
