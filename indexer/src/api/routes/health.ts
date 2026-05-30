import type { FastifyInstance } from "fastify";

import { INDEXER_CHAIN } from "../../config/chains.js";
import { prisma } from "../../lib/prisma.js";
import { serializeJsonValue } from "../serializers/bigint.js";

export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  app.get("/health", async (_request, reply) => {
    await prisma.$queryRaw`SELECT 1`;

    return reply.send(
      serializeJsonValue({
        status: "ok",
        chainId: INDEXER_CHAIN.id,
        database: "ok",
      })
    );
  });
}
