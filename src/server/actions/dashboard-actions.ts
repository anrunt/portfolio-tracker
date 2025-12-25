"use server"

import YahooFinance from "yahoo-finance2";
import { getSession } from "../better-auth/session";
import { z } from "zod";
import { db } from "../db";
import { wallet } from "../db/schema";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";

export async function searchTicker(query: string) {
  const session = await getSession()
  if (!session) {
    throw new Error("Unauthenticated");
  }

  const yahooFinance = new YahooFinance;
  const result = await yahooFinance.search(query);

  return result;
}

const walletSchema = z.object({
  name: z.coerce.string().max(50, {message: "Wallet name can't be longer than 50 characters!"}),
  currency: z.enum(["USD", "PLN"], {message: "Please selet a valid currency (USD or PLN)"})
})

export async function addWallet(prevState: { message: string, success: boolean, timestamp: number }, formData: FormData) {
  const user = await getSession()
  if (!user) {
    throw new Error("No session");
  }

  const name = formData.get("name");
  const currency = formData.get("currency");

  const result = walletSchema.safeParse({name, currency});

  if (!result.success) {
    return {
      message: result.error.issues[0].message,
      success: false,
      timestamp: Date.now()
    }
  }

  console.log("Adding wallet:", { name, currency });

  // Add data to db
  await db.insert(wallet).values({
    id: randomUUID(),
    name: result.data.name,
    userId: user.session.userId,
    currency: result.data.currency,
  });

  revalidatePath("/dashboard");
  
  return { message: "", success: true, timestamp: Date.now()};
}