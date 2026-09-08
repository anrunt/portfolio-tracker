import { getWalletChartData } from "@/server/services/chart-data";
import { TimeRange } from "@/server/actions/types";
import PerformanceChart from "../performance-chart";

interface Props {
  walletId: string;
  range: TimeRange;
}

export default async function WalletChart({ walletId, range }: Props) {
  const result = await getWalletChartData(walletId, range);

  if (result.isErr()) {
    return (
      <div className="px-5 py-8 text-center">
        <p className="font-(family-name:--font-jb-mono) text-[11px] text-destructive tracking-wider">
          ERROR: {result.error.message}
        </p>
      </div>
    );
  }

  const chartData = result.value;

  return <PerformanceChart basePath={`/dashboard/${walletId}`} range={range} data={chartData} />;
}
