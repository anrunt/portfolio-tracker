"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { Result, type SerializedResult } from "better-result";

import { getSession } from "../../better-auth/session";
import { db } from "../../db";
import { user } from "../../db/schema";
import { DatabaseError, UnauthenticatedError, ValidationError } from "../../errors";
import type { DisplayCurrency, SerializedError } from "../types";

export async function setDisplayCurrency(
  currency: DisplayCurrency
): Promise<SerializedResult<void, SerializedError>> {
  const result = await setDisplayCurrencyResult(currency);
  return Result.serialize(result.mapError((e) => e.toJSON() as SerializedError));
}

async function setDisplayCurrencyResult(
  currency: DisplayCurrency
): Promise<Result<void, UnauthenticatedError | ValidationError | DatabaseError>> {
  return Result.gen(async function* () {
    const session = await getSession();
    if (!session) {
      return Result.err(new UnauthenticatedError());
    }

    if (currency !== "USD" && currency !== "PLN") {
      return Result.err(
        new ValidationError({
          field: "currency",
          message: "Display currency must be USD or PLN.",
        })
      );
    }

    yield* Result.await(
      Result.tryPromise({
        try: async () => {
          await db
            .update(user)
            .set({ displayCurrency: currency })
            .where(eq(user.id, session.session.userId));
        },
        catch: (e) =>
          new DatabaseError({ operation: "update displayCurrency", cause: e }),
      })
    );

    revalidatePath("/dashboard");

    return Result.ok(undefined);
  });
}
