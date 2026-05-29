import { runStartupCheck } from "./lib/startup-check.js";

async function main(): Promise<void> {
  const ok = await runStartupCheck();
  if (!ok) {
    process.exit(1);
  }
}

main().catch((error: unknown) => {
  console.error("Indexer bootstrap failed:", error);
  process.exit(1);
});
