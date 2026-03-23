import type {
  FinnhubQuote,
  PriceFetchFailure,
  PriceResultData,
  PriceSuccess,
} from "../actions/types";

type Exchange = "US" | "WA";

export async function getPriceData(
  companySymbols: string[],
  exchange: Exchange
): Promise<PriceResultData> {
  if (companySymbols.length === 0) {
    return { prices: [], failures: [] };
  }

  const finnhubApiKey = process.env.FINNHUB_API_KEY;
  if (!finnhubApiKey) {
    throw new Error("[cron/snapshot] Missing configuration: FINNHUB_API_KEY");
  }

  if (exchange === "US") {
    return getFinnhubPrices(companySymbols, finnhubApiKey);
  }

  return getStooqPrices(companySymbols);
}

async function getFinnhubPrices(
  companySymbols: string[],
  finnhubApiKey: string
): Promise<PriceResultData> {
  const requests = companySymbols.map(async (symbol) => {
    const response = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${finnhubApiKey}`,
      { next: { revalidate: 60 } }
    );

    if (!response.ok) {
      throw new Error(`Finnhub ${symbol}: HTTP ${response.status}`);
    }

    const data = (await response.json()) as FinnhubQuote;

    return {
      symbol,
      price: data.c,
    } satisfies PriceSuccess;
  });

  const settledRequests = await Promise.allSettled(requests);
  const prices: PriceSuccess[] = [];
  const failures: PriceFetchFailure[] = [];

  for (let i = 0; i < settledRequests.length; i++) {
    const result = settledRequests[i];

    if (result.status === "fulfilled") {
      prices.push(result.value);
      continue;
    }

    failures.push({
      symbol: companySymbols[i],
      reason: toErrorMessage(result.reason),
    });
  }

  return { prices, failures };
}

async function getStooqPrices(companySymbols: string[]): Promise<PriceResultData> {
  const stooqSymbols = companySymbols.map((symbol) => symbol.replace(".WA", ""));

  const response = await fetch(
    `https://stooq.pl/q/l/?s=${stooqSymbols.join("+")}&f=sc&e=csv`,
    { next: { revalidate: 60 } }
  );

  if (!response.ok) {
    throw new Error(`Stooq HTTP: ${response.status}`);
  }

  const text = await response.text();
  const lines = text.trim().split("\n");
  const prices: PriceSuccess[] = [];
  const failures: PriceFetchFailure[] = [];

  for (const line of lines) {
    const [stooqSymbol, priceStr] = line.split(",");
    const originalSymbol = `${stooqSymbol}.WA`;

    if (priceStr === "B/D" || isNaN(Number(priceStr))) {
      failures.push({ symbol: originalSymbol, reason: "No data available" });
    } else {
      prices.push({ symbol: originalSymbol, price: Number(priceStr) });
    }
  }

  return { prices, failures };
}

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
