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
import RenameWallet from "./rename-wallet";

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
    <div className="w-full flex items-stretch justify-center gap-2">
      <Link
        href={`/dashboard/${wallet.id}`}
        className="flex h-12 flex-1 items-center justify-between rounded-md border border-border px-4 hover:bg-secondary transition-colors"
      >
        <span>{wallet.name}</span>
        <span className="text-muted-foreground">{formattedValue} {wallet.currency}</span>
      </Link>

      <RenameWallet walletId={wallet.id} walletName={wallet.name} />

      <Dialog key={wallet.id}>
        <DialogTrigger asChild>
          <button
            className="h-12 w-12 shrink-0 flex items-center justify-center rounded-md bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
          >
            <Trash2 className="size-4.5" />
          </button>
        </DialogTrigger>
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
