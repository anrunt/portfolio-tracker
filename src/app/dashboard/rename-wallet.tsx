"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
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

export default function RenameWallet({ walletId, walletName }: RenameWalletProps) {
  const renameWalletWithId = renameWallet.bind(null, walletId);
  const [state, formAction, pending] = useActionState(renameWalletWithId, initialState);
  const [open, setOpen] = useState(false);
  const [clientError, setClientError] = useState("");
  const [inputName, setInputName] = useState(walletName);
  const [dismissedAt, setDismissedAt] = useState(0);
  const isUnchanged = inputName.trim() === walletName || inputName.trim() === "";
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
    <Dialog open={open} onOpenChange={(isOpen) => { setOpen(isOpen); setClientError(""); setDismissedAt(state.timestamp); setInputName(walletName); }}>
      <DialogTrigger asChild>
        <button
          className="h-12 w-12 shrink-0 flex items-center justify-center rounded-md bg-primary/15 text-primary hover:bg-primary/25 transition-colors"
          aria-label={`Rename ${walletName}`}
        >
          <Pencil className="size-4.5" />
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Rename Wallet</DialogTitle>
          <DialogDescription className="text-sm pt-1">
            You are renaming{" "}
            <span className="inline-flex items-center gap-1 font-semibold text-foreground">
              {walletName}
            </span>
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor={`rename-${walletId}`} className="text-sm text-muted-foreground">
              New name
            </label>
            <input
              id={`rename-${walletId}`}
              name="name"
              type="text"
              value={inputName}
              onChange={(e) => { setInputName(e.target.value); setClientError(""); }}
              placeholder="Enter new wallet name"
              autoFocus
              className="bg-card text-card-foreground border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 w-full transition-all duration-150"
            />
          </div>

          <div>
            {(clientError || serverError) && (
              <p className="text-red-500 text-sm">{clientError || serverError}</p>
            )}
          </div>

          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" type="button">Cancel</Button>
            </DialogClose>
            <Button disabled={pending || isUnchanged} type="submit" variant="secondary">
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
