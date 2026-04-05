import { NbpResponse } from "../actions/types";

const NBP_BASE = "https://api.nbp.pl/api/exchangerates/rates/A/USD";

export async function getUsdPlnRate(
  at: Date
): Promise<{ rate: number; effectiveDate: string }> {
  const dateStr = at.toISOString().split("T")[0];

  const res = await fetch(`${NBP_BASE}/${dateStr}/?format=json`);

  if (res.ok) {
    const data = (await res.json()) as NbpResponse;
    const { mid, effectiveDate } = data.rates[0];
    return { 
      rate: mid,
      effectiveDate 
    };
  }

  if (res.status === 404) {
    const fallback = await fetch(`${NBP_BASE}/?format=json`);

    if (!fallback.ok) {
      throw new Error(
        `NBP fallback fetch failed: HTTP ${fallback.status}`
      );
    }

    const data = (await fallback.json()) as NbpResponse;
    const { mid, effectiveDate } = data.rates[0];
    return { 
      rate: mid, 
      effectiveDate 
    };
  }

  throw new Error(`NBP fetch failed for ${dateStr}: HTTP ${res.status}`);
}
