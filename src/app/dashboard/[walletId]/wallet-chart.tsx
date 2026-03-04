import { getWalletChartData } from "@/server/actions/dashboard-actions";
import { ChartDataPoint, SerializedError, TimeRange } from "@/server/actions/types";
import { Result } from "better-result";
import WalletChartClient from "./wallet-chart-client";

interface Props {
  walletId: string;
  range: TimeRange;
}

export default async function WalletChart({ walletId, range }: Props) {
  const serialized = await getWalletChartData(walletId, range);
  const deserialized = Result.deserialize<ChartDataPoint[], SerializedError>(serialized);

  if (!deserialized || Result.isError(deserialized)) {
    const error = deserialized ? deserialized.error : {message: "Unknown error"};
    return (
      <div className="px-5 py-8 text-center">
        <p className="font-(family-name:--font-jb-mono) text-[11px] text-destructive tracking-wider">
          ERROR: {error.message}
        </p>
      </div>
    );
  }

  const chartData = deserialized.value;

  return <WalletChartClient walletId={walletId} range={range} data={chartData} />;
}
