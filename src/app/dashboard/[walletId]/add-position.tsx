"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { addPosition } from "@/server/actions/dashboard-actions";
import { useParams } from "next/navigation";
import AddPositionInputs from "./add-position-inputs";

// Message for every error ?
const initialState = {
  message: "",
  success: false,
  timestamp: 0
};

interface AddPositionProps {
  selectedCompany: {
    name: string;
    symbol: string;
  };
  onBack: () => void;
  onClose: () => void;
}

export default function AddPosition({
  selectedCompany,
  onBack,
  onClose,
}: AddPositionProps) {
  const { walletId } = useParams<{walletId: string}>();

  const addPositionData = addPosition.bind(null, selectedCompany.name, selectedCompany.symbol, walletId);

  const [state, formAction, pending] = useActionState(addPositionData, initialState);

  const [positionIds, setPositionIds] = useState<string[]>([crypto.randomUUID()]);

  function addPositionRow() {
    setPositionIds((prev) => [...prev, crypto.randomUUID()]);
  }

  function removePositionRow(idToRemove: string) {
    setPositionIds((prev) => prev.filter((id) => id !== idToRemove));
  }

  useEffect(() => {
    if (state.success === true && state.timestamp !== 0) {
      startTransition(() => {
        onClose();
      });
    }
  }, [state.success, state.timestamp, onClose]);

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

      <form action={formAction} className="flex flex-col gap-4">
        <div className="max-h-[45vh] overflow-y-auto custom-scrollbar space-y-4 pr-1 -mr-1">
          {positionIds.map((id) => (
            <AddPositionInputs 
              key={id} 
              errorMessage={state.message}
              onRemove={() => removePositionRow(id)}
              showRemove={positionIds.length > 1}
            />
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/50">
          <Button onClick={() => addPositionRow()} disabled={pending} type="button" variant="outline" >
            Another position
          </Button>
          <Button disabled={pending} type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
            Add
          </Button>
        </div>
      </form>
    </div>
  );
}