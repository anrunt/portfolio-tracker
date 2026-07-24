import { ConfigError } from "@/server/errors";
import { Result } from "better-result";

export function getFinnhubConfig(): Result<{ apiKey: string }, ConfigError> {
  const apiKey = process.env.FINNHUB_API_KEY;

  if (apiKey === "" || apiKey === undefined) {
    return Result.err(
      new ConfigError({
        key: "FINNHUB_API_KEY",
      }),
    );
  }

  return Result.ok({ apiKey });
}

export function getRedisConfig(): Result<{ url: string, token: string }, ConfigError> {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;

  if (url === "" || url === undefined) {
    return Result.err(
      new ConfigError({
        key: "UPSTASH_URL",
      }),
    );
  }

  if (token === "" || token === undefined) {
    return Result.err(
      new ConfigError({
        key: "UPSTASH_TOKEN",
      }),
    );
  }

  return Result.ok({ url, token });
}
