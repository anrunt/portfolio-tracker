import { db } from "."

export const QUERIES = {
  getWallets: function(userId: string) {
    return db
      .select()
  }
}