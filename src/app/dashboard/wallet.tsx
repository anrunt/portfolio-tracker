import Link from "next/link";
import { Trash2 } from "lucide-react";
import { deleteWallet } from "@/server/actions/dashboard-actions";

interface WalletProps {
  wallet: {
    id: string;
    name: string;
    currency: string;
  };
}

export default function Wallet({ wallet }: WalletProps) {
  const deleteWalletWithId = deleteWallet.bind(null, wallet.id);

  return (
    <div className="w-full flex items-stretch gap-2">
      <Link
        href={`/dashboard/${wallet.id}`}
        className="flex-1 px-4 py-3 border border-gray-700 rounded-md hover:bg-secondary transition-colors flex items-center justify-between"
      >
        <span>{wallet.name}</span>
        <span className="text-muted-foreground">1000 {wallet.currency}</span>
      </Link>

      <form action={deleteWalletWithId} className="flex">
        <button
          type="submit"
          className="h-full aspect-square flex items-center justify-center rounded-md bg-red-500/20 text-red-500 hover:bg-red-500/30 transition-colors"
        >
          <Trash2 className="size-5" />
        </button>
      </form>
    </div>
  );
}
