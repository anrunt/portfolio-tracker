"use client";

import { useState } from "react";

type FieldErrors = {
  shares?: string;
  price?: string;
} | undefined;

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
          <label htmlFor="shares" className="block text-sm text-muted-foreground">
            Number of shares
          </label>
          {showRemove && (
            <button
              type="button"
              onClick={onRemove}
              className="p-0.5 text-muted-foreground/60 hover:text-red-500 rounded transition-colors"
              aria-label="Remove position row"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
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
          className="w-full px-3 py-2.5 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
          required
        />

        <div>
          {errors?.shares && (
            <p className="text-red-500 text-sm">{errors.shares}</p>
          )}
        </div>

      </div>

      <div className="space-y-1.5">
        <label htmlFor="price" className="block text-sm text-muted-foreground">
          Price per one
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
          className="w-full px-3 py-2.5 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-ring transition-colors"
          required
        />

        <div>
          {errors?.price && (
            <p className="text-red-500 text-sm">{errors.price}</p>
          )}
        </div>

      </div>
    </>
  );
}
