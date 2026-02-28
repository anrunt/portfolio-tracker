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

export type ChartDataPoint = {
  timestamp: number;
  label?: string;
  totalValue: number;
  totalCostBasis: number;
};

export interface PositionData {
  id: string;
  companySymbol: string;
  companyName: string;
  quantity: number;
  pricePerShare: number;
  createdAt: Date;
}