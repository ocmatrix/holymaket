import { MarketStatus } from "@prisma/client";
import type { FastifyInstance } from "fastify";

import { INDEXER_CHAIN } from "../../config/chains.js";
import { prisma } from "../../lib/prisma.js";
import { normalizeAddress } from "../../lib/address.js";
import { serializeJsonValue } from "../serializers/bigint.js";

function parseIntegerQuery(
  value: unknown,
  fallback: number,
  min: number,
  max: number
): number {
  if (typeof value !== "string" || value.length === 0) {
    return fallback;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

function parseStatusFilter(value: unknown): MarketStatus | undefined {
  if (typeof value !== "string" || value.length === 0) {
    return undefined;
  }

  switch (value.toLowerCase()) {
    case "created":
      return MarketStatus.Created;
    case "open":
      return MarketStatus.Open;
    case "closed":
      return MarketStatus.Closed;
    case "resolved":
      return MarketStatus.Resolved;
    case "canceled":
      return MarketStatus.Canceled;
    default:
      return undefined;
  }
}

export async function registerMarketRoutes(app: FastifyInstance): Promise<void> {
  app.get("/markets", async (request, reply) => {
    const query = request.query as Record<string, unknown>;
    const limit = parseIntegerQuery(query.limit, 20, 1, 100);
    const offset = parseIntegerQuery(query.offset, 0, 0, 10_000);
    const status = parseStatusFilter(query.status);

    const markets = await prisma.market.findMany({
      where: status ? { status } : undefined,
      orderBy: [
        { createdBlockNumber: "desc" },
        { marketAddress: "asc" },
      ],
      take: limit,
      skip: offset,
    });

    return reply.send(serializeJsonValue(markets));
  });

  app.get("/markets/:marketAddress", async (request, reply) => {
    const { marketAddress: rawMarketAddress } = request.params as {
      marketAddress: string;
    };
    const marketAddress = normalizeAddress(rawMarketAddress);

    const market = await prisma.market.findUnique({
      where: {
        chainId_marketAddress: {
          chainId: INDEXER_CHAIN.id,
          marketAddress,
        },
      },
    });

    if (!market) {
      return reply.code(404).send({
        error: "Market not found",
      });
    }

    return reply.send(serializeJsonValue(market));
  });

  app.get("/markets/:marketAddress/trades", async (request, reply) => {
    const { marketAddress: rawMarketAddress } = request.params as {
      marketAddress: string;
    };
    const marketAddress = normalizeAddress(rawMarketAddress);

    const trades = await prisma.trade.findMany({
      where: {
        chainId: INDEXER_CHAIN.id,
        marketAddress,
      },
      orderBy: [
        { blockNumber: "desc" },
        { logIndex: "desc" },
      ],
    });

    return reply.send(serializeJsonValue(trades));
  });
}
