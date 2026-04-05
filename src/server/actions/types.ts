export type FinnhubStock = {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
};

export type FinnhubQuote = {
  c: number;  // current price
  d: number;  // change
  dp: number; // change percent
  h: number;  // high
  l: number;  // low
  o: number;  // open
  pc: number; // previous close
  t: number;  // timestamp
};

export interface FinnhubCandlesResponse {
  c: number[]; // Close prices
  h: number[]; // High prices
  l: number[]; // Low prices
  o: number[]; // Open prices
  s: string;   // Status (zazwyczaj 'ok' lub 'no_data')
  t: number[]; // Timestamps (UNIX)
  v: number[]; // Volume (tick volume w przypadku forexu)
}

export interface ForexCandlesParams {
  symbol: string;            
  resolution: FinnhubResolution;
  from: number;              // UNIX timestamp (w sekundach)
  to: number;                // UNIX timestamp (w sekundach)
}

export type PriceSuccess = { 
  symbol: string; 
  price: number; 
};

export type PriceFetchFailure = { 
  symbol: string; 
  reason: string; 
};

export type PriceResultData = {
  prices: PriceSuccess[];
  failures: PriceFetchFailure[];
};

export type SerializedError = {
  _tag: string;
  name: string;
  message: string;
  cause?: unknown;
  stack?: string;
  [key: string]: unknown;
};

export type FieldErrors = {
  [index: number]: {
    shares?: string;
    price?: string;
  }
};

export type TimeRange = "1D" | "1W" | "1M" | "3M" | "6M" | "1YR";
export type FinnhubResolution = '15' | 'D' | 'W' | 'M';

export type ChartDataPoint = {
  timestamp: number;
  label?: string;
  /** From `numeric` snapshot columns; queries cast to `double precision` for JS. */
  totalValue: number;
  /** From `numeric` snapshot columns; queries cast to `double precision` for JS. */
  totalCostBasis: number;
};

export interface PositionData {
  id: string;
  companySymbol: string;
  companyName: string;
  /** From `numeric`; queries cast to `double precision` for JS. */
  quantity: number;
  /** From `numeric`; queries cast to `double precision` for JS. */
  pricePerShare: number;
  createdAt: Date;
}