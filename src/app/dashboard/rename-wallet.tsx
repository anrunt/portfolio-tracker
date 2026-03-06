"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil } from "lucide-react";
import { renameWallet } from "@/server/actions/dashboard-actions";

const initialState = {
  message: "",
  success: false,
  timestamp: 0,
};

interface RenameWalletProps {
  walletId: string;
  walletName: string;
}

export default function RenameWallet({
  walletId,
  walletName,
}: RenameWalletProps) {
  const renameWalletWithId = renameWallet.bind(null, walletId);
  const [state, formAction, pending] = useActionState(
    renameWalletWithId,
    initialState
  );
  const [open, setOpen] = useState(false);
  const [clientError, setClientError] = useState("");
  const [inputName, setInputName] = useState(walletName);
  const [dismissedAt, setDismissedAt] = useState(0);
  const isUnchanged =
    inputName.trim() === walletName || inputName.trim() === "";
  const serverError = state.timestamp > dismissedAt ? state.message : "";

  useEffect(() => {
    if (state.success === true && state.timestamp !== 0) {
      startTransition(() => {
        setOpen(false);
        setClientError("");
        setDismissedAt(state.timestamp);
      });
    }
  }, [state.success, state.timestamp]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setClientError("");

    const formData = new FormData(e.currentTarget);
    const newName = formData.get("name") as string;

    if (!newName || newName.trim() === "") {
      e.preventDefault();
      setClientError("Please enter a wallet name");
      return;
    }

    if (newName.trim() === walletName) {
      e.preventDefault();
      setClientError("New name must be different from the current name");
      return;
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        setOpen(isOpen);
        setClientError("");
        setDismissedAt(state.timestamp);
        setInputName(walletName);
      }}
    >
      <DialogTrigger asChild>
        <button
          className="h-10 w-10 shrink-0 flex items-center justify-center rounded border border-primary/30 text-primary hover:bg-primary/15 hover:border-primary/50 transition-all duration-150"
          aria-label={`Rename ${walletName}`}
        >
          <Pencil className="size-3.5" />
        </button>
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-[420px] bg-background border-border/50 p-0 gap-0 overflow-hidden"
        aria-describedby={undefined}
      >
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="font-(family-name:--font-jb-mono) text-sm font-bold tracking-wide text-foreground">
            RENAME_WALLET
          </DialogTitle>
          <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-wider mt-1">
            Renaming{" "}
            <span className="text-primary font-semibold">{walletName}</span>
          </p>
        </DialogHeader>

        <form
          action={formAction}
          onSubmit={handleSubmit}
          className="px-6 pb-6 pt-4 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor={`rename-${walletId}`}
              className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.15em] uppercase font-medium"
            >
              New Name
            </label>
            <input
              id={`rename-${walletId}`}
              name="name"
              type="text"
              value={inputName}
              onChange={(e) => {
                setInputName(e.target.value);
                setClientError("");
              }}
              placeholder="new_wallet_name"
              autoFocus
              className="font-(family-name:--font-jb-mono) text-[12px] bg-card text-foreground border border-border rounded px-3 py-2 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 w-full transition-all duration-150 placeholder:text-muted-foreground/30"
            />
          </div>

          {(clientError || serverError) && (
            <p className="font-(family-name:--font-jb-mono) text-[11px] text-destructive">
              {clientError || serverError}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all duration-150"
            >
              Cancel
            </button>
            <button
              disabled={pending || isUnchanged}
              type="submit"
              className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pending ? "Saving..." : "Save"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
