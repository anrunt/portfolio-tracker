import { NextRequest, NextResponse } from "next/server";
import { getPrice } from "@/server/actions/dashboard-actions";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const symbols = searchParams.get("symbol");
  const exchange = searchParams.get("exchange");

  if (!symbols || !exchange) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 });
  }  

  const result = await getPrice(symbols.split(","), exchange);

  if (result.status === "ok") {
    console.log("Result from api: ", result.value);
    return NextResponse.json(result.value);
  } else {
    return NextResponse.json(
      {error: result.error},
      {status: 500}
    )
  }
}