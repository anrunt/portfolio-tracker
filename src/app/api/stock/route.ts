import { NextRequest, NextResponse } from "next/server";
import { getPrice } from "@/server/actions/dashboard-actions";
import { getSession } from "@/server/better-auth/session";

const SUPPORTED_EXCHANGES = new Set(["US", "WA"]);

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get("symbol");
  const exchange = searchParams.get("exchange");

  if (!symbolsParam || !exchange) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  if (!SUPPORTED_EXCHANGES.has(exchange)) {
    return NextResponse.json({ error: "Unsupported exchange" }, { status: 400 });
  }

  const symbols = symbolsParam
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "Missing symbols" }, { status: 400 });
  }

  const result = await getPrice(symbols, exchange);

  if (result.status === "ok") {
    return NextResponse.json(result.value);
  } else {
    return NextResponse.json(
      { error: result.error.message },
      { status: result.error._tag === "UnauthenticatedError" ? 401 : 500 }
    )
  }
}
