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
    <div className="w-full flex items-stretch gap-2">
      <div className="flex-1 px-6 py-4 border border-gray-700 rounded-lg flex items-center justify-between bg-card text-card-foreground">
        <div className="flex items-center gap-6 w-1/3">
          <span className="font-medium text-lg w-16 shrink-0">{companySymbol}</span>
          <span className="text-muted-foreground truncate">{companyName}</span>
        </div>

        <div className="flex-1 flex justify-center">
          <span className="text-lg">{quantity}</span>
        </div>

        <div className="w-1/3 flex justify-end gap-6">
          <span className="text-lg font-medium text-right w-[160px]">
            {pricePerShare.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
//            minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            {currency}
          </span>
          <span className="text-lg font-medium text-right w-[160px]">
            {totalValue.toLocaleString(currency === "USD" ? "en-US" : "pl-PL", {
              maximumFractionDigits: 2,
            })}{" "}
            {currency}
          </span>
        </div>
      </div>

      <Dialog>
        <div className="flex">
          <DialogTrigger asChild>
            <button
              className="h-full aspect-square flex items-center justify-center rounded-md bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
            >
              <Trash2 className="size-4.5" />
            </button>
          </DialogTrigger>
        </div>
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