import { LogLevels } from "./types";

export function logMarketData(
  level: LogLevels,
  payload: { event: string; [key: string]: unknown }, // To easy need to rewrite for better
) {
  const timestamp = new Date().toISOString();

  const logObject = JSON.stringify({
    ...payload,
    level,
    timestamp
  })


  switch(level){
    case "info":
      console.log(logObject)
    break;

    case "warn":
      console.warn(logObject);
    break;

    case "error":
      console.error(logObject);
    break;
  }
}
