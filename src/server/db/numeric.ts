/** Coerce `numeric` column values from Postgres (often `string` in JS) to `number` for arithmetic. */
export function numFromDb(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

/** Serialize a JS number for `numeric` inserts (matches schema scale 10). */
export function numToNumericString(value: number): string {
  return value.toFixed(10);
}
