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

type ResolvedPortfolioChatContext =
  | {
    scope: "dashboard";
    walletId: null;
  }
  | {
    scope: "wallet";
    walletId: string;
  };

type ChatContextInput = {
  currentWalletId?: string;
};

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const {
    messages,
    context,
  }: { messages: UIMessage[]; context: ChatContextInput } = await req.json();

  const resolvedContext = await resolvePortfolioChatContext(
    context,
    session.user.id,
  );
  if (!resolvedContext) {
    return new Response("Not found", { status: 404 });
  }

  const result = streamText({
    model: groq("openai/gpt-oss-20b"),
    system: buildSystemPrompt(resolvedContext),
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

      getWalletPositions: tool({
        description: `Pobiera pozycje jednego portfela. Na dashboardzie przekaż walletId otrzymane z getWalletsOverview. Dla wszystkich portfeli wywołaj narzędzie osobno dla każdego walletId.`,
        inputSchema: z.object({
          walletId: z.string().describe("User walletId").optional(),
        }),
        execute: async ({ walletId }) => {
          const requestedWalletId = walletId;

          const targetWalletId = requestedWalletId
            ? requestedWalletId
            : context.currentWalletId;

          if (!targetWalletId) {
            return {
              status: "wallet-selection-required",
            };
          }

          const wallet = await QUERIES.getWalletById(
            targetWalletId,
            session.user.id,
          );
          if (!wallet) {
            return {
              status: "wallet-unavailable",
            };
          }

          const positions = await QUERIES.getWalletPositions(
            wallet.id,
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

async function resolvePortfolioChatContext(
  input: ChatContextInput,
  userId: string,
): Promise<ResolvedPortfolioChatContext | null> {
  if (!input.currentWalletId) {
    return {
      scope: "dashboard",
      walletId: null,
    };
  }

  const wallet = await QUERIES.getWalletById(input.currentWalletId, userId);

  if (!wallet) {
    return null;
  }

  return {
    scope: "wallet",
    walletId: wallet.id,
  };
}

function buildSystemPrompt(resolvedContext: ResolvedPortfolioChatContext) {
  const basePrompt = `
  - Jesteś asystentem analizującym portfel użytkownika.
  - Używaj tylko narzędzi dostępnych w bieżącej rozmowie.
  - Nie ujawniaj technicznych nazw ani implementacji narzędzi, ale jasno
    komunikuj brak dostępu do danych.
  - Nigdy nie próbuj wywoływać nieudostępnionego narzędzia,
    jeżeli potrzebne dane nie są dostępne, nie zgaduj, poinformuj użytkownika, że aktualnie nie masz dostępu do danych portfela.
  - Nie sugeruj użytkownikowi co ma zrobić jeżeli ty nie masz dostępu do jakiś danych.
  - Kiedy mówisz z jakiego czasu pochodzą dane, używaj sformułowań typu "Dane pochodzą z dnia {data}". Nie pisz nic wiecej.
  - Nie pokazuj id portfela.
  - jesli prosisz użytkownika o doprecyzowanie pytaj się o walute lub nazwę w zależności od kontekstu, nie proś go o id, wypisz mu dostępne opcje
  - jeśli kilka portfeli jest w tej samej walucie, to tylko wtedy poproś o doprecyzowanie, następnie wywołaj getWalletPositions.
  `;

  const routeContext =
    resolvedContext.scope === "wallet"
      ? `
           Bieżący kontekst:
           - Użytkownik ma wybrany zweryfikowany portfel.
           - Dla pytania o jeden portfel bez podania nazwy lub waluty wywołaj getWalletPositions({}) dokładnie raz.
           - Nie wywołuj wtedy getWalletsOverview.
           - Jeśli użytkownik jawnie wskaże inny portfel, jego wybór zastępuje bieżący portfel.
         `
      : `
           Bieżący kontekst:
           - Użytkownik jest na ogólnym dashboardzie.
           - Żaden portfel nie jest wybrany.
           - Gdy pytanie wymaga wskazania portfela, użyj getWalletsOverview.
           - Gdy użytkownik pyta o pozycje w portfelach w liczbie mnogiej, pobierz pozycje z każdego dostępnego portfela użytkownika; nie pytaj o wybór.
         `;

  console.log(`${basePrompt}\n${routeContext}`);

  return `${basePrompt}\n${routeContext}`;
}
