import { type NextRequest, NextResponse } from "next/server";
import { getSession } from "@/server/better-auth/session";
import { getPrices } from "@/server/services/market-data/get-prices";
import { toPriceResultData } from "@/server/services/market-data/mappers";
import type {
  Exchange,
  GetPricesInput,
} from "@/server/services/market-data/types";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const searchParams = request.nextUrl.searchParams;
  const symbolsParam = searchParams.get("symbol");
  const exchangeParam = searchParams.get("exchange");

  if (!symbolsParam || !exchangeParam) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }

  if (exchangeParam !== "US" && exchangeParam !== "WA") {
    return NextResponse.json(
      { error: "Unsupported exchange" },
      { status: 400 },
    );
  }

  const exchange: Exchange = exchangeParam;
  const symbols = symbolsParam
    .split(",")
    .map((symbol) => symbol.trim())
    .filter(Boolean);

  if (symbols.length === 0) {
    return NextResponse.json({ error: "Missing symbols" }, { status: 400 });
  }

  const input: GetPricesInput = {
    symbols,
    exchange,
    mode: "user-refresh",
    operationId: crypto.randomUUID(),
  };

  const result = await getPrices(input);

  if (result.isOk()) {
    return NextResponse.json(toPriceResultData(result.value));
  }

  const status =
    result.error._tag === "ValidationError"
      ? 400
      : result.error._tag === "ApiError"
        ? 502
        : 500;

  return NextResponse.json(
    { error: result.error.message },
    { status },
  );
}
