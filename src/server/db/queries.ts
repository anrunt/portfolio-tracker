import { and, eq } from "drizzle-orm"
import { db } from "."
import { wallet } from "./schema"

export const QUERIES = {
  getWallets: function(userId: string) {
    return db
      .select()
      .from(wallet)
      .where(eq(wallet.userId, userId))
  },

  getWalletById: async function(walletId: string, userId: string) {
    return db
      .select()
      .from(wallet)
      .where(
        and(
          eq(wallet.id, walletId),
          eq(wallet.userId, userId)
        )
      )
      .limit(1)
      .then(result => result[0])
  },
}