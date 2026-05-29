import { prisma } from "./prisma.js";

async function main(): Promise<void> {
  console.log("XMarket Indexer DB Check");

  const [marketCount, indexerStateCount, indexerEventLogCount] = await Promise.all([
    prisma.market.count(),
    prisma.indexerState.count(),
    prisma.indexerEventLog.count(),
  ]);

  console.log(`Markets: ${marketCount}`);
  console.log(`Indexer states: ${indexerStateCount}`);
  console.log(`Indexer event logs: ${indexerEventLogCount}`);
  console.log("Database check ready");
}

main()
  .catch((error: unknown) => {
    console.error("Database check failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
