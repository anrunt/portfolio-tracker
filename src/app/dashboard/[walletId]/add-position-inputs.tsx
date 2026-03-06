"use client";

import { useState } from "react";

type FieldErrors =
  | {
      shares?: string;
      price?: string;
    }
  | undefined;

interface AddPositionInputsProps {
  errors: FieldErrors;
  onRemove: () => void;
  showRemove: boolean;
}

export default function AddPositionInputs({
  errors,
  onRemove,
  showRemove,
}: AddPositionInputsProps) {
  const [shares, setShares] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");

  return (
    <>
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <label
            htmlFor="shares"
            className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.15em] uppercase font-medium"
          >
            Shares
          </label>
          {showRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-0.5 text-muted-foreground/40 hover:text-destructive rounded transition-colors"
              aria-label="Remove position row"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6L6 18" />
                <path d="M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        <input
          id="shares"
          name="shares"
          type="number"
          min="0"
          step="any"
          placeholder="e.g. 10"
          value={shares}
          onChange={(e) => setShares(e.target.value)}
          className="font-(family-name:--font-jb-mono) text-[12px] w-full px-3 py-2 rounded border border-border bg-card text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all duration-150"
          required
        />
        {errors?.shares && (
          <p className="font-(family-name:--font-jb-mono) text-[11px] text-destructive">
            {errors.shares}
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <label
          htmlFor="price"
          className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.15em] uppercase font-medium"
        >
          Price Per Share
        </label>
        <input
          id="price"
          name="price"
          type="number"
          min="0"
          step="0.01"
          placeholder="e.g. 150.00"
          value={pricePerShare}
          onChange={(e) => setPricePerShare(e.target.value)}
          className="font-(family-name:--font-jb-mono) text-[12px] w-full px-3 py-2 rounded border border-border bg-card text-foreground placeholder:text-muted-foreground/30 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 transition-all duration-150"
          required
        />
        {errors?.price && (
          <p className="font-(family-name:--font-jb-mono) text-[11px] text-destructive">
            {errors.price}
          </p>
        )}
      </div>
    </>
  );
}
