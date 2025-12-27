"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { addPosition } from "@/server/actions/dashboard-actions";
import { useParams } from "next/navigation";

// Message for every error ?
const initialState = {
  message: "",
  success: false,
  timestamp: 0
};

export default function AddPosition(
  { selectedCompany, onBack, onClose }: { selectedCompany: { name: string, symbol: string }; onBack: () => void; onClose: () => void}
) {
  const { walletId } = useParams<{walletId: string}>();

  const [shares, setShares] = useState("");
  const [pricePerShare, setPricePerShare] = useState("");

  const addPositionData = addPosition.bind(null, selectedCompany.name, selectedCompany.symbol, walletId);

  const [state, formAction, pending] = useActionState(addPositionData, initialState);

  useEffect(() => {
    if (state.success === true && state.timestamp !== 0) {
      startTransition(() => {
        onClose();
      });
    }
  }, [state.success, state.timestamp, onClose]);

//  const handleSubmit = (e: React.FormEvent) => {
//    e.preventDefault();
//    // TODO: Handle form submission and close dialog
//    console.log({ selectedCompany, shares, pricePerShare });
//  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button
          onClick={onBack}
          className="p-1 hover:bg-muted rounded-md transition-colors"
          aria-label="Go back to search"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="text-base text-muted-foreground">
          Adding position for <span className="font-mono font-semibold text-foreground">{selectedCompany.symbol}</span>
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="shares" className="block text-sm text-muted-foreground">
            Number of shares
          </label>
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
        </div>
        
        <div>
          {state.message && (
            <p className="text-red-500 text-sm">{state.message}</p>
          )}
        </div>        

        <div className="flex justify-end pt-2">
          <Button disabled={pending} type="submit" variant="outline">
            Add
          </Button>
        </div>
      </form>
    </div>
  );
}