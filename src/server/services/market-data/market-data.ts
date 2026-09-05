import "server-only";

import { Result } from "better-result";
import { getSession } from "@/server/better-auth/session";
import { UnauthenticatedError, ValidationError, type PriceError } from "@/server/errors";
import type { PriceResultData } from "@/server/actions/types";
import { getPrices } from "./get-prices";
import { toPriceResultData } from "./mappers";
import type { GetPricesInput } from "./types";

export async function getPrice(companySymbols: string[], exchange: string): Promise<Result<PriceResultData, PriceError>> {
  return Result.gen(async function* () {
    const session = await getSession();
    if (!session) {
      return Result.err(new UnauthenticatedError());
    }

    if (exchange !== "US" && exchange !== "WA") {
      return Result.err(
        new ValidationError({
          field: "exchange",
          message: "Unsupported exchange. Must be 'US' or 'WA'.",
        })
      );
    }

    const input: GetPricesInput = {
      symbols: companySymbols,
      exchange: exchange,
      mode: "user-refresh",
      operationId: crypto.randomUUID()
    }

    const prices = yield* Result.await(
      getPrices(input)
    );

    return Result.ok(toPriceResultData(prices));
  })
}
