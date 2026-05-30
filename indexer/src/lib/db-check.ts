import { prisma } from "./prisma.js";

async function main(): Promise<void> {
  console.log("XMarket Indexer DB Check");

  const [
    marketCount,
    tradeCount,
    userPositionCount,
    claimCount,
    reserveSnapshotCount,
    indexerStateCount,
    indexerEventLogCount,
  ] = await Promise.all([
    prisma.market.count(),
    prisma.trade.count(),
    prisma.userPosition.count(),
    prisma.claim.count(),
    prisma.reserveSnapshot.count(),
    prisma.indexerState.count(),
    prisma.indexerEventLog.count(),
  ]);

  console.log(`Markets: ${marketCount}`);
  console.log(`Trades: ${tradeCount}`);
  console.log(`User positions: ${userPositionCount}`);
  console.log(`Claims: ${claimCount}`);
  console.log(`Reserve snapshots: ${reserveSnapshotCount}`);
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
