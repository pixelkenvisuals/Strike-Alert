import fs from "node:fs";
import path from "node:path";
import { pollAllSources } from "../lib/poll";

function loadEnvLocal(): void {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;

  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvLocal();

pollAllSources()
  .then((result) => {
    console.log(`[${new Date().toISOString()}] poll complete:`, JSON.stringify(result));
    process.exit(0);
  })
  .catch((err) => {
    console.error(`[${new Date().toISOString()}] poll failed:`, err);
    process.exit(1);
  });
