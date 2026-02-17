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
import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteWallet } from "@/server/actions/dashboard-actions";

interface WalletProps {
  wallet: {
    id: string;
    name: string;
    currency: string;
    totalValue: number 
  };
}

export default function Wallet({ wallet }: WalletProps) {
  const deleteWalletWithId = deleteWallet.bind(null, wallet.id);

  const locale = wallet.currency === "USD" ? "en-US" : "pl-PL";
  const formattedValue = new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(wallet.totalValue);

  return (
    <div className="w-full flex items-stretch gap-2">
      <Link
        href={`/dashboard/${wallet.id}`}
        className="flex-1 px-4 py-3 border border-border rounded-md hover:bg-secondary transition-colors flex items-center justify-between"
      >
        <span>{wallet.name}</span>
        <span className="text-muted-foreground">{formattedValue} {wallet.currency}</span>
      </Link>

      <Dialog key={wallet.id}>
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
            <DialogTitle>Delete Wallet - {wallet.name}</DialogTitle>
            <DialogDescription className="text-md">
              Are you sure you want to delete this wallet? This will delete <span className="font-semibold">all positions</span> in it!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>
            <form action={deleteWalletWithId}>
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
