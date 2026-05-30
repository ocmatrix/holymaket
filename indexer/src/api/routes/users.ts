import type { FastifyInstance } from "fastify";

import { INDEXER_CHAIN } from "../../config/chains.js";
import { normalizeAddress } from "../../lib/address.js";
import { prisma } from "../../lib/prisma.js";
import { serializeJsonValue } from "../serializers/bigint.js";

export async function registerUserRoutes(app: FastifyInstance): Promise<void> {
  app.get("/users/:address/positions", async (request, reply) => {
    const { address: rawAddress } = request.params as { address: string };
    const address = normalizeAddress(rawAddress);

    const positions = await prisma.userPosition.findMany({
      where: {
        chainId: INDEXER_CHAIN.id,
        userAddress: address,
      },
      orderBy: [
        { lastBlockNumber: "desc" },
        { marketAddress: "asc" },
      ],
    });

    return reply.send(serializeJsonValue(positions));
  });

  app.get("/users/:address/trades", async (request, reply) => {
    const { address: rawAddress } = request.params as { address: string };
    const address = normalizeAddress(rawAddress);

    const trades = await prisma.trade.findMany({
      where: {
        chainId: INDEXER_CHAIN.id,
        userAddress: address,
      },
      orderBy: [
        { blockNumber: "desc" },
        { logIndex: "desc" },
      ],
    });

    return reply.send(serializeJsonValue(trades));
  });

  app.get("/users/:address/claims", async (request, reply) => {
    const { address: rawAddress } = request.params as { address: string };
    const address = normalizeAddress(rawAddress);

    const claims = await prisma.claim.findMany({
      where: {
        chainId: INDEXER_CHAIN.id,
        userAddress: address,
      },
      orderBy: [
        { blockNumber: "desc" },
        { logIndex: "desc" },
      ],
    });

    return reply.send(serializeJsonValue(claims));
  });
}
