import { groq } from '@/server/ai/groq';
import { GroqLanguageModelChatOptions } from '@ai-sdk/groq';
import { convertToModelMessages, createUIMessageStreamResponse, streamText, toUIMessageStream, UIMessage } from 'ai';
import { getSession } from '@/server/better-auth/session';

export async function POST(req: Request) {
  const session = await getSession();
  if (!session) {
    return new Response("Unauthorized", {status: 401});
  }

  const { messages }: {messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: groq("openai/gpt-oss-20b"),
    providerOptions: {
      groq: {
        reasoningFormat: "hidden",
        reasoningEffort: "low",
      } satisfies GroqLanguageModelChatOptions
    },
    messages: await convertToModelMessages(messages)
  });


  return createUIMessageStreamResponse({
    stream: toUIMessageStream({stream: result.stream})
  });
}
