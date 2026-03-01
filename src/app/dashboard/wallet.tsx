import {
  Dialog,
  DialogContent,
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
    totalValue: number;
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
    <div className="group w-full flex items-stretch gap-1.5">
      <Link
        href={`/dashboard/${wallet.id}`}
        className="flex h-10 flex-1 items-center justify-between rounded border border-border bg-card px-4 hover:border-primary/50 hover:bg-secondary/50 transition-all duration-150"
      >
        <div className="flex items-center gap-3">
          <div className="w-1 h-1 rounded-full bg-primary group-hover:bg-primary transition-colors" />
          <span className="font-(family-name:--font-jb-mono) text-[12px] text-foreground tracking-wide">
            {wallet.name}
          </span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-(family-name:--font-jb-mono) text-[12px] tabular-nums text-muted-foreground">
            {formattedValue}
          </span>
          <span className="font-(family-name:--font-jb-mono) text-[9px] text-muted-foreground font-semibold">
            {wallet.currency}
          </span>
        </div>
      </Link>

      <RenameWallet walletId={wallet.id} walletName={wallet.name} />

      <Dialog key={wallet.id}>
        <DialogTrigger asChild>
          <button className="h-10 w-10 shrink-0 flex items-center justify-center rounded border border-destructive/30 text-destructive hover:bg-destructive/15 hover:border-destructive/50 transition-all duration-150">
            <Trash2 className="size-3.5" />
          </button>
        </DialogTrigger>

        <DialogContent
          className="sm:max-w-[420px] bg-background border-border/50 p-0 gap-0 overflow-hidden"
          aria-describedby={undefined}
        >
          <DialogHeader className="px-6 pt-5 pb-0">
            <DialogTitle className="font-(family-name:--font-jb-mono) text-sm font-bold tracking-wide text-foreground">
              DELETE_WALLET
            </DialogTitle>
            <p className="font-(family-name:--font-jb-mono) text-[10px] text-muted-foreground tracking-wider mt-1">
              Target:{" "}
              <span className="text-destructive font-semibold">
                {wallet.name}
              </span>
            </p>
          </DialogHeader>

          <div className="px-6 pt-4 pb-6 space-y-4">
            <div className="rounded border border-destructive/20 bg-destructive/5 px-4 py-3">
              <p className="font-(family-name:--font-jb-mono) text-[11px] text-foreground leading-relaxed">
                This action will permanently delete this wallet and{" "}
                <span className="text-destructive font-semibold">
                  all positions
                </span>{" "}
                within it. This cannot be undone.
              </p>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-border/30">
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-border text-muted-foreground hover:text-foreground hover:border-border/80 transition-all duration-150"
                >
                  Cancel
                </button>
              </DialogTrigger>
              <form action={deleteWalletWithId}>
                <button
                  type="submit"
                  className="font-(family-name:--font-jb-mono) text-[10px] tracking-widest uppercase px-4 py-2 rounded border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 hover:border-destructive/60 transition-all duration-150 flex items-center gap-1.5"
                >
                  Delete
                  <Trash2 className="size-3" />
                </button>
              </form>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
