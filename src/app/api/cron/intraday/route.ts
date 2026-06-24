import { NextRequest, NextResponse } from "next/server";
import { runSnapshot } from "@/server/services/run-snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if ( req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}` ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const summary = await runSnapshot("intraday");
  return NextResponse.json(summary);
}
