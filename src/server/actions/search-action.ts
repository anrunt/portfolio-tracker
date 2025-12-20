"use server"

import YahooFinance from "yahoo-finance2";
import { getSession } from "../better-auth/session";

export async function searchTicker(query: string) {
  const session = await getSession()
  if (!session) {
    throw new Error("Unauthenticated");
  }

  const yahooFinance = new YahooFinance;
  const result = await yahooFinance.search(query);

//  console.log(result);
  return result;
}