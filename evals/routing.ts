import { isDeepStrictEqual } from "node:util";
import { buildSystemPrompt } from "@/server/ai/chat/system-prompt";
import { generateText } from "ai";
import { groq } from "@/server/ai/groq";
import { GroqLanguageModelChatOptions } from "@ai-sdk/groq";
import { CHAT_TOOL_DEFINITIONS } from "@/server/ai/chat/tools/definitions";
import { z } from "zod";

type ToolName = keyof typeof CHAT_TOOL_DEFINITIONS;

type ToolInput<Name extends ToolName> = z.infer<
  (typeof CHAT_TOOL_DEFINITIONS)[Name]["inputSchema"]
>;

type EvalCase = {
  [Name in ToolName]: {
    prompt: string;
    expectedTool: Name;
    expectedInputs: ToolInput<Name>[];
  };
}[ToolName];

type EvalResult = EvalCase & {
  givenTool: ToolName | null;
  givenInput: unknown;
  result: "PASS" | "FAIL";
};

type TransactionHistoryInput = ToolInput<"getTransactionHistory">;

const EVALS: EvalCase[] = [
  {
    prompt: "Czy mam pozycje nvidia w ktoryms z moich portfeli?",
    expectedTool: "getHoldingsAnalysis",
    expectedInputs: [{}],
  },
  {
    prompt: "Czy mam pozycje nvidia w portfelu USA?",
    expectedTool: "getHoldingsAnalysis",
    expectedInputs: [{}],
  },
  {
    prompt: "Czy mam pozycje nvidia w portfelu POLSKA?",
    expectedTool: "getHoldingsAnalysis",
    expectedInputs: [{}],
  },
  {
    prompt: "Jakie mam pozycje w moich portfelach?",
    expectedTool: "getHoldingsAnalysis",
    expectedInputs: [{}],
  },
  {
    prompt: "Czy posiadam w swoim portfolio cyberfolks i nvidia?",
    expectedTool: "getHoldingsAnalysis",
    expectedInputs: [{}],
  },
  {
    prompt: "Pobierz historie moich transakcji dla spolki nvidia",
    expectedTool: "getTransactionHistory",
    expectedInputs: [
      {
        companyNameOrSymbol: "NVIDIA",
        walletScope: "unspecified",
      },
      {
        companyNameOrSymbol: "NVDA",
        walletScope: "unspecified",
      },
    ],
  },
  {
    prompt: "Po ile kupowalem nvda w portfelu usa?",
    expectedTool: "getTransactionHistory",
    expectedInputs: [
      {
        companyNameOrSymbol: "NVIDIA",
        walletScope: "specified",
        walletNames: ["usa"],
      },
      {
        companyNameOrSymbol: "NVDA",
        walletScope: "specified",
        walletNames: ["usa"],
      },
    ],
  },
  {
    prompt: "Pobierz historie transakcji nvidia ze wszystkich moich portfeli",
    expectedTool: "getTransactionHistory",
    expectedInputs: [
      {
        companyNameOrSymbol: "NVIDIA",
        walletScope: "all",
      },
      {
        companyNameOrSymbol: "NVDA",
        walletScope: "all",
      },
    ],
  },
];

async function main() {
  const evalResults: EvalResult[] = [];

  for (const evalCase of EVALS) {
    const modelResult = await getModelResult(evalCase.prompt);
    const toolCall = modelResult.toolCalls[0];

    const givenTool =
      toolCall && isToolName(toolCall.toolName) ? toolCall.toolName : null;
    const givenInput: unknown = toolCall?.input ?? null;

    const passed =
      givenTool === evalCase.expectedTool &&
      inputsMatch(evalCase, givenInput);

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
    console.log(`Expected inputs: ${JSON.stringify(evalResult.expectedInputs)}`);
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

function isToolName(toolName: string): toolName is ToolName {
  return toolName in CHAT_TOOL_DEFINITIONS;
}

function inputsMatch(evalCase: EvalCase, givenInput: unknown) {
  switch (evalCase.expectedTool) {
    case "getWalletsOverview": {
      const parsedInput =
        CHAT_TOOL_DEFINITIONS.getWalletsOverview.inputSchema.safeParse(givenInput);

      return (
        parsedInput.success &&
        evalCase.expectedInputs.some((expectedInput) =>
          isDeepStrictEqual(parsedInput.data, expectedInput),
        )
      );
    }
    case "getHoldingsAnalysis": {
      const parsedInput =
        CHAT_TOOL_DEFINITIONS.getHoldingsAnalysis.inputSchema.safeParse(
          givenInput,
        );

      return (
        parsedInput.success &&
        evalCase.expectedInputs.some((expectedInput) =>
          isDeepStrictEqual(parsedInput.data, expectedInput),
        )
      );
    }
    case "getTransactionHistory": {
      const parsedInput =
        CHAT_TOOL_DEFINITIONS.getTransactionHistory.inputSchema.safeParse(
          givenInput,
        );

      return (
        parsedInput.success &&
        evalCase.expectedInputs.some((expectedInput) =>
          transactionHistoryInputsMatch(expectedInput, parsedInput.data),
        )
      );
    }
  }
}

function transactionHistoryInputsMatch(
  expectedInput: TransactionHistoryInput,
  givenInput: TransactionHistoryInput,
) {
  const expectedWalletNames = expectedInput.walletNames
    ?.map((name) => name.toLowerCase())
    .sort();
  const givenWalletNames = givenInput.walletNames
    ?.map((name) => name.toLowerCase())
    .sort();

  const companyMatches =
    expectedInput.companyNameOrSymbol.toLowerCase() ===
    givenInput.companyNameOrSymbol.toLowerCase();

  const walletScopeMatches =
    expectedInput.walletScope === givenInput.walletScope;

  const walletNamesMatch = isDeepStrictEqual(
    expectedWalletNames,
    givenWalletNames,
  );

  return companyMatches && walletScopeMatches && walletNamesMatch;
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
    tools: CHAT_TOOL_DEFINITIONS,
    prompt,
  });
}

main().catch((error) => {
  console.error("Routing evals failed:", error);
  process.exitCode = 1;
});
