"use client"

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
import { Trash2 } from "lucide-react";
import { deletePosition } from "@/server/actions/dashboard-actions";

interface PositionProps {
  walletId: string;
  positionId: string;
  companySymbol: string;
  companyName: string;
  quantity: number;
  pricePerShare: number;
  currency: string;
  gridLayoutClass: string;
}

export default function Position({
  walletId,
  positionId,
  companySymbol,
  companyName,
  quantity,
  pricePerShare,
  currency,
  gridLayoutClass,
}: PositionProps) {
  const deletePositionWithId = deletePosition.bind(null, positionId, walletId);
  const totalValue = pricePerShare * quantity;

  return (
    <div className={`w-full ${gridLayoutClass} p-4 hover:bg-white/5 transition-colors group/item border-b border-gray-800/50 last:border-0`}>
      <div className="text-gray-600 font-mono text-xs flex items-center">
        <div className="w-1.5 h-1.5 rounded-full bg-gray-700 mr-2 group-hover/item:bg-gray-500 transition-colors" />
      </div>
      
      <div className="text-gray-500 text-xs truncate">
      </div>

      <div className="text-right font-mono text-sm text-gray-400">
        {quantity}
      </div>
      
      <div className="text-right font-mono text-sm text-gray-400">
        {totalValue.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        })}{" "}
        <span className="text-[10px] text-gray-600">{currency}</span>
      </div>

      <div className="text-right font-mono text-sm text-gray-400">
        {pricePerShare.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
          maximumFractionDigits: 2,
          minimumFractionDigits: 2,
        })}{" "}
        <span className="text-[10px] text-gray-600">{currency}</span>
      </div>

      <div className="text-right font-mono text-sm text-gray-600">
        N/A
      </div>

      <div className="flex justify-end">
        <Dialog>
          <DialogTrigger asChild>
            <button
              className="flex items-center justify-center text-gray-600 hover:text-red-500 transition-colors shrink-0 p-2"
            >
              <Trash2 className="size-4 opacity-0 group-hover/item:opacity-100 transition-opacity" />
            </button>
          </DialogTrigger>
          <DialogContent className="bg-neutral-900 border-gray-800 text-white">
            <DialogHeader>
              <DialogTitle>Delete Position - {companySymbol}</DialogTitle>
              <DialogDescription className="text-gray-400">
                Are you sure you want to delete this position?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <DialogClose asChild>
                <Button variant="outline" className="border-gray-700 hover:bg-gray-800 text-gray-300">Cancel</Button>
              </DialogClose>
              <form action={deletePositionWithId}>
                <button
                  type="submit"
                  className="h-9 px-4 py-2 flex items-center justify-center gap-1 rounded-md bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-colors text-sm font-medium w-full sm:w-auto"
                >
                  Delete
                  <Trash2 className="size-4" />
                </button>
              </form>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
