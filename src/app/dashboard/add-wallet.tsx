"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus } from "lucide-react";
import { addWallet } from "@/server/actions/dashboard-actions";

const initialState = {
  message: "",
  success: false,
  timestamp: 0,
};

export default function AddWallet() {
  const [state, formAction, pending] = useActionState(addWallet, initialState);
  const [open, setOpen] = useState(false);
  const [currency, setCurrency] = useState<string>("");
  const [clientError, setClientError] = useState<string>("");

  useEffect(() => {
    if (state.success === true && state.timestamp !== 0) {
      startTransition(() => {
        setOpen(false);
        setCurrency("");
      });
    }
  }, [state.success, state.timestamp]);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    setClientError("");

    if (!currency) {
      e.preventDefault();
      setClientError("Please select a currency");
      return;
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50 transition-all duration-150 cursor-pointer">
          <Plus className="size-3" />
          <span className="font-(family-name:--font-jb-mono) text-[10px] font-semibold tracking-[0.15em] uppercase">
            Add Wallet
          </span>
        </button>
      </DialogTrigger>

      <DialogContent
        className="sm:max-w-[420px] bg-background border-border/50 p-0 gap-0 overflow-hidden"
        aria-describedby={undefined}
      >
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="font-(family-name:--font-jb-mono) text-sm font-bold tracking-wide text-foreground">
            NEW_WALLET
          </DialogTitle>
          <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-wider mt-1">
            Create a new portfolio wallet
          </p>
        </DialogHeader>

        <form
          action={formAction}
          onSubmit={handleSubmit}
          className="px-6 pb-6 pt-4 flex flex-col gap-4"
        >
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="name"
              className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.15em] uppercase font-medium"
            >
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="wallet_name"
              className="font-(family-name:--font-jb-mono) text-[12px] bg-card text-foreground border border-border rounded px-3 py-2 focus:outline-none focus:border-primary/60 focus:ring-1 focus:ring-primary/20 w-full transition-all duration-150 placeholder:text-muted-foreground/30"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="currency"
              className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-[0.15em] uppercase font-medium"
            >
              Currency
            </label>
            <input type="hidden" name="currency" value={currency} />
            <Select
              value={currency}
              onValueChange={(value) => {
                setCurrency(value);
                setClientError("");
              }}
            >
              <SelectTrigger className="font-(family-name:--font-jb-mono) text-[12px] bg-card text-foreground border border-border rounded px-3 py-2 h-auto focus:border-primary/60 w-full">
                <SelectValue placeholder="select_currency" />
              </SelectTrigger>
              <SelectContent className="bg-card border border-border">
                <SelectItem
                  value="USD"
                  className="font-(family-name:--font-jb-mono) text-[12px] text-foreground focus:bg-primary/10 focus:text-foreground"
                >
                  USD
                </SelectItem>
                <SelectItem
                  value="PLN"
                  className="font-(family-name:--font-jb-mono) text-[12px] text-foreground focus:bg-primary/10 focus:text-foreground"
                >
                  PLN
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {(clientError || state.message) && (
            <p className="font-(family-name:--font-jb-mono) text-[11px] text-destructive">
              {clientError || state.message}
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
              disabled={pending}
              type="submit"
              className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 hover:border-primary/60 transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {pending ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
