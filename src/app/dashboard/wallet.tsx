import Link from "next/link";

interface WalletProps {
  wallet: {
    id: string;
    name: string;
    currency: string;
  };
}

export default function Wallet({ wallet }: WalletProps) {
  return (
    <Link
      href={`/dashboard/${wallet.id}`}
      className="w-full px-4 py-3 border border-gray-700 rounded-md hover:bg-secondary transition-colors flex items-center justify-between"
    >
      <span>{wallet.name}</span>
      <span className="text-muted-foreground">1000 {wallet.currency}</span>
    </Link>
  );
}
