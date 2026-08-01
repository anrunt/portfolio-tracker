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
        description: `Pobiera pozycje portfela. Na dashboardzie przekaż walletId otrzymane z getWalletsOverview. Dla wszystkich portfeli wywołaj narzędzie osobno dla każdego walletId.`,
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
  - Ceny akcji podawaj w walucie portfela w którym te akcje się znajdują czyli jeżeli akcja znajduje się w portfelu z currency USD to akcja jest w walucie USD
  `;

  const routeContext =
    resolvedContext.scope === "wallet"
      ? `
        Bieżący kontekst:
        - Użytkownik znajduje się na stronie wybranego portfela o id ${resolvedContext.walletId}.
        - Kiedy użytkownik pyta się o akcje w portfelach (czyli pyta sie o pare portfeli) oznacza to konieczność sprawdzenia wszystkich portfeli i ma pierwszeństwo przed kontekstem aktualnie wybranego portfela. Najpierw pobierz listę portfeli, następnie pobierz pozycje osobno dla każdego zwróconego portfela. Nie odpowiadaj i nie przerywaj wyszukiwania, dopóki nie otrzymasz pozycji ze wszystkich portfeli — również wtedy, gdy znajdziesz szukaną pozycję wcześniej.
        - Jeżeli pytanie nie zawiera żadnej nazwy konkretnego portfela i odnosi sie tylko do jednego portfelA (czyli pyta sie o jeden niewskazany portfel) to wszystkie pytania dotyczące akcji i pozycji odnoszą się do aktualnie wybranego portfela. Wywołaj wtedy getWalletPositions({}) dokładnie raz i nie wywołuj getWalletsOverview.
        - Jeżeli użytkownik poda nazwę lub walutę konkretnego portfela, pytanie dotyczy wskazanego portfela. Najpierw wywołaj getWalletsOverview, aby go odnaleźć, a następnie getWalletPositions z jego walletId.
        - Jeżeli nazwa lub waluta pasuje do kilku portfeli, poproś użytkownika o doprecyzowanie nazwy portfela, inaczej nie proś o to.
        `
      : `
        Bieżący kontekst:
        - Użytkownik jest na ogólnym dashboardzie.
        - Żaden portfel nie jest wybrany.
        - Gdy pytanie wymaga wskazania portfela, użyj getWalletsOverview.
        - Przy każdym pytaniu, czy użytkownik posiada jedną lub więcej wskazanych pozycji, zawsze sprawdź wszystkie dostępne portfele. Najpierw pobierz listę portfeli, następnie pobierz pozycje osobno dla każdego zwróconego portfela. Nie odpowiadaj i nie przerywaj wyszukiwania, dopóki nie otrzymasz pozycji ze wszystkich portfeli — również wtedy, gdy znajdziesz szukaną pozycję wcześniej.
        `;

  console.log(`${basePrompt}\n${routeContext}`);

  return `${basePrompt}\n${routeContext}`;
}
