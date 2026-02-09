export type FinnhubStock = {
  description: string;
  displaySymbol: string;
  symbol: string;
  type: string;
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
