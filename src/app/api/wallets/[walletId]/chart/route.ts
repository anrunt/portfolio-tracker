import { type NextRequest, NextResponse } from "next/server";
import { timeRangeSchema, type ChartResponse } from "@/lib/chart-query";
import { getWalletChartData } from "@/server/services/chart-data";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ walletId: string }> },
) {
  const range = timeRangeSchema.safeParse(
    request.nextUrl.searchParams.get("range") ?? "1D",
  );
  if (!range.success) {
    return NextResponse.json(
      { error: "Unsupported chart range" },
      { status: 400, headers },
    );
  }

  try {
    const { walletId } = await params;
    // The service checks the session and wallet ownership before reading history.
    const result = await getWalletChartData(walletId, range.data);
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
    console.error("Failed to load wallet chart", error);
    return NextResponse.json(
      { error: "Unable to load performance history" },
      { status: 500, headers },
    );
  }
}
