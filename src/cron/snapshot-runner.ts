import { closeDb } from "@/server/db";
import { runSnapshot } from "@/server/services/run-snapshot";

function parseType(arg: string | undefined): "daily" | "intraday" {
  if (arg === "daily" || arg === "intraday") {
    return arg;
  }

  throw new Error("Snapshot type must be 'daily' or 'intraday'");
}

async function main() {
  const type = parseType(process.argv[2]);
  let exitCode = 0;

  try {
    console.log(`[cron] Starting snapshot job: ${type}`);

    const summary = await runSnapshot(type);

    console.log("[cron] Snapshot job completed successfully");
    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    exitCode = 1;
    console.error("[cron] Snapshot job failed");
    console.error(err);
  } finally {
    try {
      await closeDb();
      console.log("[cron] DB connection closed");
    } catch (err) {
      exitCode = 1;
      console.error("[cron] Failed to close DB connection");
      console.error(err);
    }
  }

  process.exit(exitCode);
}

main();