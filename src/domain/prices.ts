import { z } from "zod";

const priceSuccessSchema = z.object({
  symbol: z.string(),
  price: z.number().positive(),
});

const priceFetchFailureSchema = z.object({
  symbol: z.string(),
  reason: z.string(),
});

export const priceResultSchema = z.object({
  prices: z.array(priceSuccessSchema),
  failures: z.array(priceFetchFailureSchema),
});

export type PriceSuccess = z.infer<typeof priceSuccessSchema>;
export type PriceFetchFailure = z.infer<typeof priceFetchFailureSchema>;
export type PriceResultData = z.infer<typeof priceResultSchema>;
