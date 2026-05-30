import { INDEXER_CHAIN } from "../config/chains.js";
import { requireEnv } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { publicClient } from "../lib/public-client.js";
import { syncConfig } from "./config.js";
import { runFactorySync } from "./factory-sync.js";

async function main(): Promise<void> {
  requireEnv("DATABASE_URL");

  console.log("XMarket Indexer Event Sync");
  console.log(`Chain ID: ${INDEXER_CHAIN.id}`);
  console.log(`Factory scope: ${syncConfig.scope}`);
  console.log(`Factory state key: ${syncConfig.contractAddress}`);

  const chainId = await publicClient.getChainId();
  if (chainId !== INDEXER_CHAIN.id) {
    throw new Error(
      `Chain ID mismatch: expected ${INDEXER_CHAIN.id}, got ${chainId}`
    );
  }

  await runFactorySync();
  console.log("Sync completed");
}

main()
  .catch((error: unknown) => {
    console.error("Indexer event sync failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
