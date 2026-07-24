import { type NextRequest, NextResponse } from "next/server";
import { logMarketData } from "@/server/services/market-data/logger";
import { runSnapshot } from "@/server/services/run-snapshot";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_JOB_SECRET;
  if (
    !cronSecret ||
    req.headers.get("authorization") !== `Bearer ${cronSecret}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const operationId = crypto.randomUUID();

  logMarketData("info", {
    event: "snapshot_cron_started",
    operationId,
    type: "daily",
  });

  try {
    const summary = await runSnapshot("daily", operationId);

    logMarketData("info", {
      event: "snapshot_cron_completed",
      operationId,
      type: "daily",
      summary,
    });

    return NextResponse.json(summary);
  } catch (error) {
    logMarketData("error", {
      event: "snapshot_cron_failed",
      operationId,
      type: "daily",
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Snapshot cron failed",
        operationId,
      },
      { status: 500 },
    );
  }
}
