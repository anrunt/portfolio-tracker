import { createGetHoldingsAnalysisTool } from "./get-holdings-analysis";
import { createGetTransactionHistoryTool } from "./get-transaction-history";
import { createGetWalletsOverviewTool } from "./get-wallets-overview";
import type { ChatToolContext } from "./types";

export function createChatTools(context: ChatToolContext) {
  return {
    getWalletsOverview: createGetWalletsOverviewTool(context),
    getHoldingsAnalysis: createGetHoldingsAnalysisTool(context),
    getTransactionHistory: createGetTransactionHistoryTool(context),
  };
}
