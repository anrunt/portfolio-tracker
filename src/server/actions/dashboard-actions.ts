"use server"

import { getSession } from "../better-auth/session";
import { z } from "zod";
import { db } from "../db";
import { position, wallet } from "../db/schema";
import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { QUERIES } from "../db/queries";
import { and, eq } from "drizzle-orm";

export type FinnhubStock = {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
};

export async function searchTicker(query: string, exchange: string = "US"): Promise<FinnhubStock[]> {
  const session = await getSession();
  if (!session) {
    throw new Error("Unauthenticated");
  }

  const FINNHUB_API_KEY = process.env.FINNHUB_API_KEY; 

  if (!FINNHUB_API_KEY) {
    throw new Error("Missing Finnhub API Key");
  }

  if (exchange !== "US" && exchange !== "WA") {
    throw new Error("Unsupported exchange");
  }

  // Exchanges = US, WA
  const response = await fetch(
    `https://finnhub.io/api/v1/search?q=${query}&token=${FINNHUB_API_KEY}&exchange=${exchange}`
  );

  if (!response.ok) {
    throw new Error(`Finnhub API error: ${response.statusText}`);
  }

  const data = await response.json();

  console.log("Finnhub data: ", data.result);
  return data.result as FinnhubStock[];
}

//export async function searchTicker(query: string) {
//  const session = await getSession()
//  if (!session) {
//    throw new Error("Unauthenticated");
//  }
//
//  const yahooFinance = new YahooFinance;
//  const result = await yahooFinance.search(query);
//
//  return result;
//}

const walletSchema = z.object({
  name: z.coerce.string().max(50, {message: "Wallet name can't be longer than 50 characters!"}),
  currency: z.enum(["USD", "PLN"], {message: "Please select a valid currency (USD or PLN)"})
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

  revalidatePath(`/dashboard/${walletId}`);

  return {
    message: "",
    success: true,
    timestamp: Date.now()
  }
}

export async function deleteWallet(walletId: string) {
  const user = await getSession();
  if (!user) {
    throw new Error("No session");
  }

  await db.delete(wallet).where(
    and(
      eq(wallet.id, walletId),
      eq(wallet.userId, user.session.userId)
    )
  );

  revalidatePath("/dashboard");
}

export async function deletePosition(positionId: string, walletId: string) {
  const user = await getSession();
  if (!user) {
    throw new Error("Unauthorized");
  }

  const userWallet = await QUERIES.getWalletById(walletId, user.session.userId);

  if (!userWallet) {
    throw new Error("No wallet for this userId");
  }

  // Delte user position from this wallet
  await db
    .delete(position)
    .where(
      and(
        eq(position.id, positionId),
        eq(position.walletId, walletId)
      )
    )

  revalidatePath(`/dashboard/${walletId}`);
}