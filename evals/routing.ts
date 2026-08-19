import { isDeepStrictEqual } from "node:util";
import { buildSystemPrompt } from "@/server/ai/chat/system-prompt";
import { generateText } from "ai";
import { groq } from "@/server/ai/groq";
import { GroqLanguageModelChatOptions } from "@ai-sdk/groq";
import { CHAT_TOOL_CONTRACTS } from "@/server/ai/chat/tool-contracts";

type ToolName = keyof typeof CHAT_TOOL_CONTRACTS;

type EvalCase = {
  prompt: string;
  expectedTool: ToolName;
  expectedInput: Record<string, unknown>;
};

type EvalResult = {
  prompt: string;
  expectedTool: ToolName;
  expectedInput: Record<string, unknown>;
  givenTool: ToolName | null;
  givenInput: Record<string, unknown> | null;
  result: "PASS" | "FAIL";
};

const EVALS = [
  {
    prompt: "Czy mam pozycje nvidia w ktoryms z moich portfeli?",
    expectedTool: "getHoldingsAnalysis",
    expectedInput: {},
  },
  {
    prompt: "Czy mam pozycje nvidia w portfelu USA?",
    expectedTool: "getHoldingsAnalysis",
    expectedInput: {},
  },
  {
    prompt: "Czy mam pozycje nvidia w portfelu POLSKA?",
    expectedTool: "getHoldingsAnalysis",
    expectedInput: {},
  },
  {
    prompt: "Jakie mam pozycje w moich portfelach?",
    expectedTool: "getHoldingsAnalysis",
    expectedInput: {},
  },
  {
    prompt: "Czy posiadam w swoim portfolio cyberfolks i nvidia?",
    expectedTool: "getHoldingsAnalysis",
    expectedInput: {},
  },
  {
    prompt: "Pobierz historie moich transakcji dla spolki nvidia",
    expectedTool: "getTransactionHistory",
    expectedInput: {
      companyNameOrSymbol: "NVIDIA",
      walletScope: "unspecified",
    },
  },
  {
    prompt: "Po ile kupowalem nvidia w portfelu usa?",
    expectedTool: "getTransactionHistory",
    expectedInput: {
      companyNameOrSymbol: "NVIDIA",
      walletScope: "specified",
      walletNames: ["usa"],
    },
  },
  {
    prompt: "Pobierz historie transakcji nvidia ze wszystkich moich portfeli",
    expectedTool: "getTransactionHistory",
    expectedInput: {
      companyNameOrSymbol: "NVIDIA",
      walletScope: "all",
    },
  },
] satisfies EvalCase[];

async function main() {
  const evalResults: EvalResult[] = [];

  for (const evalCase of EVALS) {
    const modelResult = await getModelResult(evalCase.prompt);
    const toolCall = modelResult.toolCalls[0];

    const givenTool =
      (toolCall?.toolName as ToolName | undefined) ??
      null;
    const givenInput =
      (toolCall?.input as Record<string, unknown> | undefined) ?? null;

    const passed =
      givenTool === evalCase.expectedTool &&
      isDeepStrictEqual(givenInput, evalCase.expectedInput);

    evalResults.push({
      ...evalCase,
      givenTool,
      givenInput,
      result: passed ? "PASS" : "FAIL",
    });
  }

  for (const evalResult of evalResults) {
    console.log(`\n${evalResult.result}: ${evalResult.prompt}`);
    console.log(`Expected tool: ${evalResult.expectedTool}`);
    console.log(`Given tool: ${evalResult.givenTool ?? "NO TOOL CALL"}`);
    console.log(`Expected input: ${JSON.stringify(evalResult.expectedInput)}`);
    console.log(`Given input: ${JSON.stringify(evalResult.givenInput)}`);
  }

  const passedCount = evalResults.filter(
    (evalResult) => evalResult.result === "PASS",
  ).length;

  console.log(`\nResult: ${passedCount}/${evalResults.length} evals passed.`);

  if (passedCount !== evalResults.length) {
    process.exitCode = 1;
  }
}

async function getModelResult(prompt: string) {
  return generateText({
    model: groq("openai/gpt-oss-20b"),
    system: buildSystemPrompt(),
    providerOptions: {
      groq: {
        reasoningFormat: "hidden",
        reasoningEffort: "low",
      } satisfies GroqLanguageModelChatOptions,
    },
    tools: {
      ...CHAT_TOOL_CONTRACTS,
    },
    prompt,
  });
}

main().catch((error) => {
  console.error("Routing evals failed:", error);
  process.exitCode = 1;
});
