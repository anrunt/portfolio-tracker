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

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

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
      - Nie używaj słowa "snapshot" kiedy mówisz z jakiego czasu pochodzą dane.
    `,
    providerOptions: {
      groq: {
        reasoningFormat: "hidden",
        reasoningEffort: "low",
      } satisfies GroqLanguageModelChatOptions,
    },
    stopWhen: isStepCount(5),
    tools: {
      getLatestWalletSnapshots: tool({
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
            name: wallet.name,
            currency: wallet.currency,
            totalValue: wallet.totalValue,
            netInvested: wallet.netInvested,
            snapshotAt: wallet.snapshotAt?.toISOString() ?? null,
          }));
        },
      }),
    },
    onStepEnd: ({ toolResults }) => {
      console.log(toolResults)
    },
    messages: await convertToModelMessages(messages),
  });

  return createUIMessageStreamResponse({
    stream: toUIMessageStream({ stream: result.stream }),
  });
}
