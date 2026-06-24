import { NextRequest, NextResponse } from "next/server";
import { runSnapshot } from "@/server/services/run-snapshot";

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (
    req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[cron auth]", {
    hasSecret: Boolean(process.env.CRON_SECRET),
    secretLength: process.env.CRON_SECRET?.length,
    authLength: req.headers.get("authorization")?.length,
  });

  const summary = await runSnapshot("intraday");
  return NextResponse.json(summary);
}
