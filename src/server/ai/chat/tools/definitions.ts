import type { ToolSet } from "ai";
import { getHoldingsAnalysisDefinition } from "./get-holdings-analysis";
import { getTransactionHistoryDefinition } from "./get-transaction-history";
import { getWalletsOverviewDefinition } from "./get-wallets-overview";

export const CHAT_TOOL_DEFINITIONS = {
  getWalletsOverview: getWalletsOverviewDefinition,
  getHoldingsAnalysis: getHoldingsAnalysisDefinition,
  getTransactionHistory: getTransactionHistoryDefinition,
} as const satisfies ToolSet;
