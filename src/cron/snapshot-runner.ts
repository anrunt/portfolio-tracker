import { runSnapshot } from "@/server/services/run-snapshot";

function parseType(arg: string | undefined): "daily" | "intraday" {
  if (arg === "daily" || arg === "intraday") {
    return arg;
  }

  throw new Error("Snapshot type must be 'daily' or 'intraday'");
}

async function main() {
  const type = parseType(process.argv[2]);

  console.log(`[cron] Starting snapshot job: ${type}`);

  const summary = await runSnapshot(type);

  console.log(`[cron] Snapshot job completed succesfully`);
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((err) => {
  console.error("[cron] Snapshot job failed");
  console.error(err);
  process.exit(1);
})