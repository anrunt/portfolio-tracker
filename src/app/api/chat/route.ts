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

type Position = Awaited<ReturnType<typeof QUERIES.getWalletPositions>>[number];
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

  const { messages, context }: { messages: UIMessage[], context: {currentWalletId: string}} = await req.json();

  const result = streamText({
    model: groq("openai/gpt-oss-20b"),
    system: `
      - Jesteś asystentem analizującym portfel użytkownika.
      - Używaj tylko narzędzi dostępnych w bieżącej rozmowie.
      - Nie ujawniaj technicznych nazw ani implementacji narzędzi, ale jasno
        komunikuj brak dostępu do danych.
      - Nigdy nie próbuj wywoływać nieudostępnionego narzędzia,
        jeżeli potrzebne dane nie są dostępne, nie zgaduj, poinformuj użytkownika, że aktualnie nie masz dostępu do danych portfela.
      - Nie sugeruj użytkownikowi co ma zrobić jeżeli ty nie masz dostępu do jakiś danych.
      - Kiedy mówisz z jakiego czasu pochodzą dane, używaj sformułowań typu "Dane pochodzą z dnia {data}". Nie pisz nic wiecej.
      - Nie pokazuj id portfela.
      - getWalletsOverview służy również do znalezenia id portfela po nazwie lub walucie
      - jeśli pytanie dotyczy pozycji, ale nie ma ID, najpierw wywołaj getWalletsOverview,
      - jeśli kilka portfeli jest w tej samej walucie, to tylko wtedy poproś o doprecyzowanie, następnie wywołaj getWalletPositions.
      - jesli prosisz użytkownika o doprecyzowanie pytaj się o walute lub nazwę w zależności od kontekstu, nie proś go o id, wypisz mu dostępne opcje
      - Gdy użytkownik pyta o pozycje w portfelach w liczbie mnogiej, pobierz pozycje każdego portfela; nie pytaj o wybór.
    `,
    providerOptions: {
      groq: {
        reasoningFormat: "hidden",
        reasoningEffort: "low",
      } satisfies GroqLanguageModelChatOptions,
    },
    stopWhen: isStepCount(10),
    tools: {
      getWalletsOverview: tool({
        description: `Pobiera podsumowanie wartości portfeli użytkownika.
          Użyj tego narzędzia, gdy użytkownik pyta o wartość swoich portfeli lub jakie ma portfele w swoim portfolio.
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

      getWalletPositions: tool({
        description: `Pobiera listę pozycji z portfela użytkownika`,
        inputSchema: z.object({
          walletId: z.string().describe("User walletId"),
        }),
        execute: async ({ walletId }) => {
          const wallet = await QUERIES.getWalletById(walletId, session.user.id);
          if (!wallet) {
            return {
              status: "wallet-unavailable",
            };
          }

          const positions = await QUERIES.getWalletPositions(
            walletId,
            session.user.id,
          );

          return {
            status: "success",
            wallet: {
              name: wallet.name,
              currency: wallet.currency,
            },
            positions: aggregateWalletPositions(positions),
          };
        },
      }),
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

function aggregateWalletPositions(
  positions: Position[],
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
