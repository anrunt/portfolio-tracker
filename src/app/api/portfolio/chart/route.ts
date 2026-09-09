import { type NextRequest, NextResponse } from "next/server";
import { supportedCurrencySchema } from "@/domain/currency";
import { timeRangeSchema, type ChartResponse } from "@/lib/chart-query";
import { getAllWalletsPortfolioData } from "@/server/services/chart-data";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const range = timeRangeSchema.safeParse(params.get("range") ?? "1D");
  const currency = supportedCurrencySchema.safeParse(params.get("currency"));

  if (!range.success || !currency.success) {
    return NextResponse.json(
      { error: "Unsupported chart range or currency" },
      { status: 400, headers },
    );
  }

  try {
    // The service uses the authenticated user, never a user ID from the request.
    const result = await getAllWalletsPortfolioData(range.data, currency.data);
    if (result.isErr()) {
      const status =
        result.error._tag === "UnauthenticatedError"
          ? 401
          : result.error._tag === "UnauthorizedError"
            ? 403
            : result.error._tag === "ValidationError"
              ? 400
              : 404;
      return NextResponse.json(
        { error: result.error.message },
        { status, headers },
      );
    }

    return NextResponse.json(
      { points: result.value } satisfies ChartResponse,
      { headers },
    );
  } catch (error) {
    console.error("Failed to load portfolio chart", error);
    return NextResponse.json(
      { error: "Unable to load performance history" },
      { status: 500, headers },
    );
  }
}
