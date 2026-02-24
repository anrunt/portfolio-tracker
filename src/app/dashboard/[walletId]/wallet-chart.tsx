import { getWalletChartDataResult } from "@/server/actions/dashboard-actions";
import { TimeRange } from "@/server/actions/types";

interface Props {
  walletId: string;
  range: TimeRange;
}

export default async function WalletChart({ walletId, range }: Props) {
  // Fetch data 
  // Transform it 
  // Render chart component
  await getWalletChartDataResult(walletId, range)

  return (
    <h1>Siema</h1>
  )
}
