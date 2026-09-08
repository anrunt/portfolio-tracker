import { z } from "zod";

export const SUPPORTED_CURRENCIES = ["USD", "PLN"] as const;

export const supportedCurrencySchema = z.enum(SUPPORTED_CURRENCIES, {
  error: "Please select a valid supported currency",
});

export type SupportedCurrency = z.infer<typeof supportedCurrencySchema>;
