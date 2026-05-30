import { getEnv, requireEnv } from "../config/env.js";
import { prisma } from "../lib/prisma.js";
import { buildApiServer } from "./server.js";

async function main(): Promise<void> {
  requireEnv("DATABASE_URL");

  const port = Number.parseInt(getEnv("INDEXER_API_PORT", "4000"), 10);
  const server = await buildApiServer();

  const shutdown = async () => {
    await server.close();
    await prisma.$disconnect();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await server.listen({
    host: "0.0.0.0",
    port,
  });

  console.log(`XMarket Indexer API listening on http://localhost:${port}`);
}

main().catch(async (error: unknown) => {
  console.error("Indexer API failed:", error);
  await prisma.$disconnect();
  process.exit(1);
});
