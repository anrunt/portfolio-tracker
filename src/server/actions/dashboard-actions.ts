"use server"

import YahooFinance from "yahoo-finance2";
import { getSession } from "../better-auth/session";
import { z } from "zod";
import { db } from "../db";
import { position, wallet } from "../db/schema";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { QUERIES } from "../db/queries";

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

  await db.insert(wallet).values({
    id: randomUUID(),
    name: result.data.name,
    userId: user.session.userId,
    currency: result.data.currency,
  });

  revalidatePath("/dashboard");
  
  return { message: "", success: true, timestamp: Date.now()};
}


const positionSchema = z.object({
  companyName: z.string(),
  companySymbol: z.string(),
  shares: z.coerce.number().nonnegative({message: "Invalid share number, must be nonnegative"}),
  price: z.coerce.number().nonnegative({message: "Invalid price number, must be nonnegative"})
})

export async function addPosition(companyName: string, companySymbol: string, walletId: string, prevState: { message: string, success: boolean, timestamp: number }, formData: FormData) {
  const user = await getSession()
  if (!user) {
    throw new Error("No session");
  }

  const wallet = await QUERIES.getWalletById(walletId, user.session.userId);
  if (!wallet) {
    throw new Error("No wallet for this user");
  }

  const validatedFields = positionSchema.safeParse({
    companyName: companyName,
    companySymbol: companySymbol,
    shares: formData.get("shares"),
    price: formData.get("price") 
  })

  if (!validatedFields.success) {
    console.log("Err with validating position: ", validatedFields.error)
    
    return {
      message: validatedFields.error.issues[0].message,
      success: false,
      timestamp: Date.now()
    }
  }

  await db.insert(position).values({
    id: randomUUID(),
    walletId: walletId,
    companyName: companyName,
    companySymbol: companySymbol,
    pricePerShare: validatedFields.data.price,
    quantity: validatedFields.data.shares,
  });

  return {
    message: "",
    success: true,
    timestamp: Date.now()
  }
}