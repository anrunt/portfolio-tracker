import { getWalletChartData } from "@/server/actions/dashboard-actions";
import { ChartDataPoint, SerializedError, TimeRange } from "@/server/actions/types";
import { Result } from "better-result";

interface Props {
  walletId: string;
  range: TimeRange;
}

export default async function WalletChart({ walletId, range }: Props) {
  // Fetch data 
  // Transform it 
  // Render chart component

  // Remember to handle error
  const serialized = await getWalletChartData(walletId, range);
  const deserialized = Result.deserialize<ChartDataPoint[], SerializedError>(serialized);

  if (!deserialized || Result.isError(deserialized)) {
    const error = deserialized ? deserialized.error : {message: "Unknown error"};
    return (
      <p>Error loading chart: {error.message}</p>
    )
  }

  const chartData = deserialized.value;
  console.log("Chart data: ", chartData);

  return (
    <h1>Siema</h1>
  )
}
