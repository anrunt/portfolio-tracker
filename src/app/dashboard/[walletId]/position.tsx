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
}

export default function Position({
  walletId,
  positionId,
  companySymbol,
  companyName,
  quantity,
  pricePerShare,
  currency,
}: PositionProps) {
  const deletePositionWithId = deletePosition.bind(null, positionId, walletId);
  const totalValue = pricePerShare * quantity;

  return (
    <div className="w-full flex items-center gap-2">
      <div className="flex-1 min-w-0 px-4 py-4 border border-gray-700 rounded-lg flex items-center justify-between bg-card text-card-foreground gap-2">
        <div className="flex items-center gap-3 min-w-0 overflow-hidden flex-1">
          <span className="font-medium text-lg w-16 shrink-0">{companySymbol}</span>
          <span className="text-muted-foreground truncate">{companyName}</span>
        </div>

        <div className="flex items-center gap-4 sm:gap-8 shrink-0">
          <div className="text-right w-12 sm:w-16">
            <span className="text-lg">{quantity}</span>
          </div>
          
          <div className="text-right w-24 sm:w-32 hidden sm:block">
            <span className="text-lg font-medium">
              {pricePerShare.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
                maximumFractionDigits: 2,
              })}{" "}
              {currency}
            </span>
          </div>

          <div className="text-right w-24 sm:w-32">
            <span className="text-lg font-medium">
              {totalValue.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
                maximumFractionDigits: 2,
              })}{" "}
              {currency}
            </span>
          </div>
        </div>
      </div>

      <Dialog>
        <DialogTrigger asChild>
          <button
            className="w-14 h-14 flex items-center justify-center rounded-md bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors shrink-0"
          >
            <Trash2 className="size-5" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Position - {companySymbol}</DialogTitle>
            <DialogDescription className="text-md">
              Are you sure you want to delete this position?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <form action={deletePositionWithId}>
              <button
                type="submit"
                className="h-9 px-4 py-2 flex items-center justify-center gap-1 rounded-md bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors text-sm font-medium"
              >
                Delete
                <Trash2 className="size-4" />
              </button>
            </form>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
