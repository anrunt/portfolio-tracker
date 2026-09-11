import "server-only";

import { cache } from "react";
import { QUERIES } from "@/server/db/queries";

export const getWalletForUser = cache(
  async (walletId: string, userId: string) =>
    QUERIES.getWalletById(walletId, userId),
);
