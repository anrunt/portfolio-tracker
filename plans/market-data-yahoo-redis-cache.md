# Market Data: Yahoo GPW + Redis Cache + Shared Price Flow

## Goal

Replace the broken Stooq GPW price path with Yahoo Finance chart API, introduce Redis-backed user-facing price caching, and consolidate price fetching into one shared `market-data` service used by dashboard/server actions, `/api/stock`, and HTTP cron snapshots.

This plan is intentionally simple and educational: use only the system-design pieces needed now — cache, retry for snapshots, limited concurrency for Yahoo, structured logs, and lightweight operation tracing.

## Final decisions

### Price modes

Use one service with a single mode field:

```ts
type GetPricesInput = {
  symbols: string[];
  exchange: "US" | "WA";
  mode: "user-refresh" | "snapshot";
  operationId?: string;
};
```

Mode semantics:

- `user-refresh`
  - used by dashboard SSR initial load and `/api/stock` polling
  - uses Redis cache
  - Redis config is required
  - no provider retry
  - fresh cache window: 60s
  - stale-if-error max age: 5min
- `snapshot`
  - used by `runSnapshot(...)` / HTTP cron
  - completely bypasses Redis: no read, no write
  - live provider data only
  - retry enabled: 5 attempts

### Providers

- `WA` / GPW prices: Yahoo Finance chart endpoint via manual `fetch`
- `US` prices: Finnhub quote endpoint
- `searchTicker(...)`: stays on Finnhub and is out of scope
- Do not use `yahoo-finance2` in this flow yet; leave the dependency untouched for now

Yahoo endpoint:

```txt
https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?interval=15m&range=1d
```

Yahoo price extraction order:

1. `chart.result[0].meta.regularMarketPrice`
2. fallback: last non-null valid value from `chart.result[0].indicators.quote[0].close`

### Cache

Use Upstash Redis via `@upstash/redis`.

Install:

```bash
npm install @upstash/redis
```

Required env for `user-refresh` mode:

```txt
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
```

Behavior:

- missing Redis config in `user-refresh` => `ConfigError`
- Redis runtime read/write/delete failure => structured log + fail open
- invalid cache payload => log + delete key + treat as cache miss
- cache only successful prices, never failures
- cache per symbol, not per batch
- cache key format:

```txt
market-price:v1:{provider}:{exchange}:{symbol}
```

Examples:

```txt
market-price:v1:yahoo:WA:XTB.WA
market-price:v1:finnhub:US:AAPL
```

TTL strategy:

- Redis key TTL: 5 minutes
- payload includes `fetchedAt`
- fresh cache hit if `age <= 60s`
- stale candidate if `60s < age <= 5min`
- stale is returned only if live API fails in `user-refresh`

### Returned data

New internal service result:

```ts
type MarketPrice = {
  symbol: string;
  price: number;
  currency: "USD" | "PLN";
  provider: "finnhub" | "yahoo";
  fetchedAt: string;
  cacheStatus: "hit" | "miss" | "stale-if-error" | "bypass";
};

type MarketPriceResultData = {
  prices: MarketPrice[];
  failures: PriceFetchFailure[];
};
```

Existing UI-facing type remains:

```ts
type PriceResultData = {
  prices: { symbol: string; price: number }[];
  failures: PriceFetchFailure[];
};
```

Boundary helper:

```ts
function toPriceResultData(data: MarketPriceResultData): PriceResultData {
  return {
    prices: data.prices.map(({ symbol, price }) => ({ symbol, price })),
    failures: data.failures,
  };
}
```

### `cacheStatus` meanings

`cacheStatus` describes where the final returned price came from:

- `hit` — fresh Redis cache
- `miss` — live API after cache miss/expired/read issue
- `stale-if-error` — stale Redis cache after live API failure
- `bypass` — live API because snapshot mode intentionally skipped cache

Do not overload `cacheStatus` with detailed cache problems. Details like expired/invalid/read-error/write-error go to structured logs and summary counters.

### Currency

Do not overcomplicate currency validation.

- `WA` + Yahoo => `PLN`
- `US` + Finnhub => `USD`

### Partial success contract

`getPrices(...)` returns partial results:

```ts
Result.ok({ prices, failures })
```

Use `failures[]` for per-symbol problems:

- timeout for one symbol
- 429/5xx after retry for one symbol
- Yahoo has no price for one symbol
- Zod parse failed for one symbol
- WA symbol does not end with `.WA`

Use `Result.err(MarketDataError)` only for whole-operation problems:

- unsupported exchange
- missing required provider config
- missing Redis config in `user-refresh`
- invalid mode if type safety is bypassed

Snapshot behavior:

- `runSnapshot(...)` must abort the whole snapshot if any requested symbol has no price or if `failures[]` is not empty
- do not create partial/misleading snapshots

Dashboard behavior:

- can display partial prices and failures

### Symbols

Canonical GPW symbol format in the app is `*.WA`, e.g. `XTB.WA`.

Input handling in `getPrices(...)`:

- `trim()`
- `toUpperCase()`
- dedupe with `Set`
- do not automatically append `.WA`
- if `exchange === "WA"` and symbol does not end with `.WA`, put that symbol into `failures[]`
- empty symbols array returns OK empty result

### Retry

Retry classification:

Retry:

- network/fetch throw
- timeout
- HTTP `408`, `425`, `429`, `500`, `502`, `503`, `504`

Do not retry:

- HTTP `400`, `401`, `403`, `404`
- validation parse error
- no price in valid provider response
- unsupported exchange
- missing config

Configs:

`user-refresh`:

```ts
{
  attempts: 1,
  timeoutMs: 5_000,
}
```

`snapshot`:

```ts
{
  attempts: 5,
  timeoutMs: 15_000,
  baseDelayMs: 1_000,
  maxDelayMs: 15_000,
  jitterMs: 1_000,
}
```

Use exponential backoff + jitter. Respect `Retry-After` if present and reasonable.

### Concurrency

- Yahoo/WA: limited concurrency `2`
- Finnhub/US: keep parallel `Promise.allSettled` style because current Finnhub rate limits are acceptable

Limited concurrency means at most 2 Yahoo requests in flight at once. Retry happens inside a worker and does not create request bursts.

### Polling

Current polling is in:

```txt
src/hooks/use-prices.ts
```

Change:

```ts
refetchInterval: 60_000
```

to:

```ts
refetchInterval: 75_000
```

Reason:

- Redis fresh TTL is 60s
- polling every 75s should normally fetch fresh provider data
- cache still protects against F5 spam, multiple users, quick navigation, and duplicate short-window requests

### Observability

Use structured JSON logs through `console.log/error`, no external logging provider for now.

Add lightweight `operationId` tracing:

- `getPrices(...)` creates an `operationId` if caller does not pass one
- HTTP cron route creates `operationId` and passes it down to `runSnapshot(...)`, then `getPrices(...)`
- every market-data structured log includes `operationId`

Log volume policy:

- always log batch summary
- detailed logs only for retry, stale-if-error, invalid cache, cache read/write/delete failure, provider failure
- do not log every successful symbol in detail

Summary log example:

```json
{
  "event": "market_price_batch_completed",
  "operationId": "...",
  "mode": "user-refresh",
  "exchange": "WA",
  "symbolCount": 4,
  "successCount": 3,
  "failureCount": 1,
  "cacheHits": 2,
  "cacheMisses": 1,
  "cacheExpired": 1,
  "cacheInvalid": 0,
  "cacheReadErrors": 0,
  "cacheWriteErrors": 0,
  "staleIfErrorCount": 0,
  "providerCalls": 2,
  "retryCount": 0,
  "durationMs": 842
}
```

Metrics are only fields in structured logs for now. No Prometheus, no Redis counters, no Sentry, no email/Discord alerts.

Cron alerting surface:

- cron route returns HTTP 500 JSON on failure
- cron route logs structured `snapshot_cron_failed`
- monitoring is manual through Vercel/Cloudflare logs for now

### Out of scope

Do not implement now:

- own rate limiter
- queue/background worker system
- intraday snapshot idempotency window
- external alerting provider
- OpenTelemetry tracing
- UI badges for stale prices
- migration of `searchTicker`
- removal of `yahoo-finance2`
- removal of old `src/server/services/snapshot.ts`

## File plan

Create:

```txt
src/server/services/market-data/
  cache.ts
  config.ts
  get-prices.ts
  logger.ts
  providers.ts
  retry.ts
  types.ts
```

Keep for now but stop importing:

```txt
src/server/services/snapshot.ts
```

Add `@deprecated` comment to `snapshot.ts` manually or during implementation.

## File responsibilities

### `types.ts`

Define:

```ts
export type Exchange = "US" | "WA";
export type MarketDataMode = "user-refresh" | "snapshot";
export type MarketDataProvider = "finnhub" | "yahoo";
export type MarketCurrency = "USD" | "PLN";
export type CacheStatus = "hit" | "miss" | "stale-if-error" | "bypass";

export type GetPricesInput = {
  symbols: string[];
  exchange: Exchange;
  mode: MarketDataMode;
  operationId?: string;
};

export type MarketPrice = {
  symbol: string;
  price: number;
  currency: MarketCurrency;
  provider: MarketDataProvider;
  fetchedAt: string;
  cacheStatus: CacheStatus;
};

export type MarketPriceResultData = {
  prices: MarketPrice[];
  failures: PriceFetchFailure[];
};

export type MarketDataError = ConfigError | ValidationError | ApiError;
```

Also define helpers/constants as needed:

```ts
export const FRESH_CACHE_TTL_MS = 60_000;
export const STALE_CACHE_TTL_SECONDS = 300;
export const STALE_CACHE_MAX_AGE_MS = 300_000;
```

### `config.ts`

Define small config helpers returning `Result`:

```ts
getFinnhubConfig(): Result<{ apiKey: string }, ConfigError>
getRedisConfig(): Result<{ url: string; token: string }, ConfigError>
```

Rules:

- Finnhub config required when fetching US prices
- Redis config required only in `user-refresh` mode
- snapshot mode must not initialize Redis

### `logger.ts`

Define:

```ts
logMarketData(level, payload)
```

Implementation:

- add timestamp
- stringify JSON
- use `console.log`, `console.warn`, or `console.error`
- keep payload serializable

Example events:

- `market_price_cache_invalid`
- `market_price_cache_read_failed`
- `market_price_cache_write_failed`
- `market_price_cache_delete_failed`
- `market_price_provider_retry`
- `market_price_provider_failed`
- `market_price_stale_if_error_used`
- `market_price_batch_completed`

### `retry.ts`

Define:

```ts
fetchWithRetry(url, options, retryConfig, context)
```

or a generic wrapper:

```ts
withRetry(() => fetch(...), retryConfig, context)
```

Need:

- timeout per attempt via `AbortSignal.timeout(...)`
- retryable HTTP status classification
- retryable network/timeout errors
- exponential backoff
- jitter
- optional `Retry-After` support
- structured log for retry attempts

### `providers.ts`

Define provider functions returning a single `MarketPrice` without cache concern:

```ts
fetchYahooWaPrice(symbol, options): Promise<MarketPrice>
fetchFinnhubUsPrice(symbol, options): Promise<MarketPrice>
```

Inputs should include:

```ts
{
  mode: MarketDataMode;
  operationId: string;
  cacheStatus: "miss" | "bypass";
}
```

Provider functions:

- perform manual fetch
- parse `response.json()` as `unknown`
- validate with minimal tolerant Zod schemas
- convert provider response into `MarketPrice`
- set `fetchedAt = new Date().toISOString()` when the app accepts the price
- set currency from exchange/provider mapping:
  - Yahoo WA => `PLN`
  - Finnhub US => `USD`

Zod schemas:

- `YahooChartResponseSchema`
- `FinnhubQuoteSchema`

Do not validate entire Yahoo response strictly. Only validate/read the fields needed.

### `cache.ts`

Define Zod schema for cached payload:

```ts
CachedMarketPriceSchema
```

Use `@upstash/redis`.

Functions can be shaped like:

```ts
createRedisPriceCache(config)
getCachedMarketPrice(symbol/provider/exchange/context)
setCachedMarketPrice(price/context)
deleteCachedMarketPrice(key/context)
```

Cache read should distinguish internally:

- fresh hit
- stale candidate
- miss
- expired beyond stale window
- invalid payload
- read error

But final `MarketPrice.cacheStatus` remains only:

```ts
"hit" | "miss" | "stale-if-error" | "bypass"
```

Runtime Redis failure handling:

- read failure: log and continue as miss
- write failure: log and still return fresh API price
- delete failure after invalid payload: log and continue

Missing Redis config is not handled here as fail-open; it should be `ConfigError` before cache construction in `get-prices.ts` for `user-refresh`.

### `get-prices.ts`

Main orchestration:

```ts
export async function getPrices(
  input: GetPricesInput
): Promise<Result<MarketPriceResultData, MarketDataError>>
```

High-level flow:

1. Create or reuse `operationId`
2. Start timer
3. Normalize symbols:
   - trim
   - uppercase
   - dedupe
4. If no symbols: return OK empty result
5. Validate exchange/provider choice
6. Validate required config:
   - `US` => Finnhub config
   - `user-refresh` => Redis config
7. Split invalid per-symbol cases into `failures[]`
   - `WA` symbol missing `.WA`
8. For valid symbols:
   - if `mode === "user-refresh"`: use cache flow
   - if `mode === "snapshot"`: bypass cache and fetch live
9. Use provider-specific concurrency:
   - Yahoo limited concurrency 2
   - Finnhub parallel
10. Collect `prices[]` and `failures[]`
11. Log batch summary with metrics fields
12. Return `Result.ok({ prices, failures })`

Add helper:

```ts
export function toPriceResultData(data: MarketPriceResultData): PriceResultData
```

User-refresh per-symbol flow:

```txt
read Redis
if fresh hit:
  return cached price with cacheStatus hit
else:
  remember stale candidate if available
  do one live provider attempt
  if live succeeds:
    write to cache with Redis TTL 5min
    return fresh price with cacheStatus miss
  if live fails and stale candidate age <= 5min:
    log stale-if-error
    return stale price with cacheStatus stale-if-error
  else:
    return per-symbol failure
```

Snapshot per-symbol flow:

```txt
skip Redis entirely
fetch live with snapshot retry config
return price with cacheStatus bypass or per-symbol failure
```

## Integration plan

### 1. Install dependency

```bash
npm install @upstash/redis
```

Add envs locally and in Vercel:

```txt
UPSTASH_REDIS_REST_URL=...
UPSTASH_REDIS_REST_TOKEN=...
```

### 2. Add new market-data module

Create files under:

```txt
src/server/services/market-data/
```

Implement in this order:

1. `types.ts`
2. `logger.ts`
3. `config.ts`
4. `retry.ts`
5. `providers.ts`
6. `cache.ts`
7. `get-prices.ts`

### 3. Update server action

File:

```txt
src/server/actions/dashboard/market-data.ts
```

Keep `searchTicker(...)` as Finnhub.

Rewrite `getPrice(...)` wrapper:

- checks session
- validates exchange at boundary if desired
- calls:

```ts
getPrices({
  symbols: companySymbols,
  exchange,
  mode: "user-refresh",
})
```

- maps `MarketPriceResultData` to `PriceResultData`
- serializes result for UI

Do not duplicate Finnhub/Stooq/Yahoo fetch logic here.

### 4. Update `/api/stock`

File:

```txt
src/app/api/stock/route.ts
```

Change it to use `getPrices(...)` directly, not server action `getPrice(...)`.

Flow:

- check session
- parse `symbol` and `exchange`
- call:

```ts
getPrices({
  symbols,
  exchange,
  mode: "user-refresh",
})
```

- map to `PriceResultData`
- return 200 for partial success
- return error status only for `Result.err`

### 5. Update snapshot runner service

File:

```txt
src/server/services/run-snapshot.ts
```

Change import from old:

```ts
import { getPriceData } from "./snapshot";
```

to new:

```ts
import { getPrices } from "./market-data/get-prices";
```

Call separately for US and WA:

```ts
getPrices({ symbols: [...US_Symbols], exchange: "US", mode: "snapshot", operationId })
getPrices({ symbols: [...WA_Symbols], exchange: "WA", mode: "snapshot", operationId })
```

Then:

- unwrap `Result`
- abort on `Result.err`
- abort if any `failures[]`
- build `allPrices` from `MarketPrice.price`

Update logs from Stooq to Yahoo/market-data.

Change signature:

```ts
runSnapshot(type: "daily" | "intraday", options?: { operationId?: string })
```

### 6. Update cron API routes

Files:

```txt
src/app/api/cron/intraday/route.ts
src/app/api/cron/daily/route.ts
```

Add wrapper:

- auth via `CRON_JOB_SECRET`
- generate `operationId`
- log `snapshot_cron_started`
- call `runSnapshot(type, { operationId })`
- log `snapshot_cron_completed`
- catch errors
- log `snapshot_cron_failed`
- return JSON 500:

```json
{
  "error": "Snapshot cron failed",
  "operationId": "..."
}
```

### 7. Update local CLI runner

File:

```txt
src/cron/snapshot-runner.ts
```

Keep it as local test helper, not production path.

Add:

```ts
const operationId = crypto.randomUUID();
await runSnapshot(type, { operationId });
```

### 8. Update dashboard polling

File:

```txt
src/hooks/use-prices.ts
```

Change:

```ts
refetchInterval: 60_000
```

to:

```ts
refetchInterval: 75_000
```

### 9. Deprecate old snapshot price service

File:

```txt
src/server/services/snapshot.ts
```

Add comment near top:

```ts
/**
 * @deprecated Replaced by src/server/services/market-data/get-prices.ts.
 * Kept temporarily for reference during the market-data migration.
 */
```

Do not import it from runtime code after migration.

## Testing checklist

### Static checks

```bash
npx eslint src/server/services/market-data src/server/actions/dashboard/market-data.ts src/app/api/stock/route.ts src/server/services/run-snapshot.ts src/app/api/cron/intraday/route.ts src/app/api/cron/daily/route.ts src/hooks/use-prices.ts
```

If full `npm run lint` fails because of unrelated `opensrc/` files, note that separately.

### Manual provider tests

Use dashboard or temporary script to verify:

- `XTB.WA` returns PLN price through Yahoo
- `CBF.WA` returns PLN price through Yahoo
- `AAPL` returns USD price through Finnhub
- bad WA symbol without `.WA` goes to `failures[]`
- invalid symbol goes to `failures[]`, not `Result.err`

### Cache behavior tests

For `user-refresh`:

1. First call for `XTB.WA`
   - expect provider call
   - summary log `cacheMisses >= 1`
   - Redis key exists with TTL around 5min
2. Second call within 60s
   - expect cache hit
   - no provider call for that symbol
3. Wait over 60s but under 5min
   - provider should be called
   - if provider succeeds, cache updates
4. Simulate provider failure while stale key exists
   - expect stale-if-error return
   - structured log `market_price_stale_if_error_used`

### Snapshot behavior tests

- Run intraday HTTP cron or local runner
- Confirm snapshot mode logs `cacheStatus: bypass` / no Redis read/write logs
- If any price failure occurs, snapshot aborts and does not create misleading partial snapshot

### Cron route tests

- Missing/wrong auth header returns 401
- Successful run returns summary JSON
- Forced failure returns HTTP 500 JSON with `operationId`
- Logs can be filtered by `operationId`

## Documentation already added

- `CONTEXT.md` contains domain language for User Price Refresh, Snapshot Price Fetch, Market Price, Snapshot, Company Symbol.
- `docs/adr/0001-market-price-cache.md` records the Redis cache decision.
