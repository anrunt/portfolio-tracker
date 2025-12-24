"use client";

import { startTransition, useActionState, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
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
import { addWallet} from "@/server/actions/dashboard-actions";

const initialState = {
  message: "",
  success: false,
  timestamp: 0
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
        <Button variant="outline">Add Wallet</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Add Wallet</DialogTitle>
        </DialogHeader>

        <form action={formAction} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="name" className="text-sm text-muted-foreground">
              Name
            </label>
            <input
              id="name"
              name="name"
              type="text"
              placeholder="Name"
              className="bg-black text-white border border-gray-700 rounded px-3 py-2 focus:outline-none focus:border-blue-500 w-full"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="currency" className="text-sm text-muted-foreground">
              Currency
            </label>
            <input type="hidden" name="currency" value={currency} />
            <Select value={currency} onValueChange={(value) => { setCurrency(value); setClientError(""); }}>
              <SelectTrigger className="bg-black text-white border border-gray-700 rounded px-3 py-2 h-auto focus:border-blue-500 w-full">
                <SelectValue placeholder="Currency" />
              </SelectTrigger>
              <SelectContent className="bg-black border border-gray-700">
                <SelectItem
                  value="USD"
                  className="text-white focus:bg-gray-800 focus:text-white"
                >
                  USD
                </SelectItem>
                <SelectItem
                  value="PLN"
                  className="text-white focus:bg-gray-800 focus:text-white"
                >
                  PLN
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            {(clientError || state.message) && (
              <p className="text-red-500 text-sm">{clientError || state.message}</p>
            )}
          </div>

          <div className="flex justify-end pt-2">
            <Button disabled={pending} type="submit" variant="secondary">
              Add
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
