"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { addPosition } from "@/server/actions/dashboard-actions";
import { useParams } from "next/navigation";
import AddPositionInputs from "./add-position-inputs";

const initialState = {
  message: "",
  success: false,
  timestamp: 0,
  fieldErrors: undefined,
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
  const { walletId } = useParams<{ walletId: string }>();

  const addPositionData = addPosition.bind(
    null,
    selectedCompany.name,
    selectedCompany.symbol,
    walletId
  );

  const [state, formAction, pending] = useActionState(
    addPositionData,
    initialState
  );

  const [positionIds, setPositionIds] = useState<string[]>([
    crypto.randomUUID(),
  ]);

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
          className="p-1 hover:bg-muted rounded transition-colors"
          aria-label="Go back to search"
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
            <path d="M19 12H5" />
            <path d="M12 19l-7-7 7-7" />
          </svg>
        </button>
        <p className="font-(family-name:--font-jb-mono) text-[11px] text-muted-foreground tracking-wider">
          Adding position for{" "}
          <span className="font-semibold text-foreground">
            {selectedCompany.symbol}
          </span>
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div className="max-h-[45vh] overflow-y-auto custom-scrollbar space-y-4 pr-1 -mr-1">
          {positionIds.map((id, index) => (
            <div key={id}>
              {index > 0 && (
                <div className="border-t border-border/30 my-2" />
              )}
              <AddPositionInputs
                errors={state.fieldErrors?.[index]}
                onRemove={() => removePositionRow(id)}
                showRemove={positionIds.length > 1}
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
          <button
            onClick={() => addPositionRow()}
            disabled={pending}
            type="button"
            className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            + Another
          </button>
          <button
            disabled={pending}
            type="submit"
            className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {pending ? "Adding..." : "Add"}
          </button>
        </div>
      </form>
    </div>
  );
}
