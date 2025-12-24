import { eq } from "drizzle-orm"
import { db } from "."
import { wallet } from "./schema"

export const QUERIES = {
  getWallets: function(userId: string) {
    return db
      .select()
      .from(wallet)
      .where(eq(wallet.userId, userId))
  }
}