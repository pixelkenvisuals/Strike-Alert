import webpush from "web-push";
import fs from "node:fs";
import path from "node:path";

const keys = webpush.generateVAPIDKeys();
const envPath = path.join(process.cwd(), ".env.local");

const lines = [`VAPID_PUBLIC_KEY=${keys.publicKey}`, `VAPID_PRIVATE_KEY=${keys.privateKey}`];

if (fs.existsSync(envPath)) {
  const existing = fs.readFileSync(envPath, "utf-8");
  if (existing.includes("VAPID_PUBLIC_KEY=")) {
    console.log(".env.local already has VAPID keys — leaving it untouched.");
    process.exit(0);
  }
  fs.appendFileSync(envPath, `\n${lines.join("\n")}\n`);
} else {
  fs.writeFileSync(envPath, `${lines.join("\n")}\n`);
}

console.log("Generated VAPID keys and wrote them to .env.local");
