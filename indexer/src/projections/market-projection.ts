import {
  MarketOutcome,
  MarketStatus,
  type Prisma,
} from "@prisma/client";

import { normalizeAddress } from "../lib/address.js";

interface MarketResolution {
  status: MarketStatus;
  outcome: MarketOutcome;
}

export function parseResolvedMarketOutcome(
  outcome: bigint
): MarketResolution {
  if (outcome === 1n) {
    return {
      status: MarketStatus.Resolved,
      outcome: MarketOutcome.Yes,
    };
  }

  if (outcome === 2n) {
    return {
      status: MarketStatus.Resolved,
      outcome: MarketOutcome.No,
    };
  }

  if (outcome === 3n || outcome === 4n) {
    return {
      status: MarketStatus.Canceled,
      outcome: MarketOutcome.Unresolved,
    };
  }

  throw new Error(`Unsupported resolved market outcome: ${outcome}`);
}

export async function markMarketOpenIfCreated(
  tx: Prisma.TransactionClient,
  input: {
    chainId: number;
    marketAddress: string;
  }
): Promise<void> {
  await tx.market.updateMany({
    where: {
      chainId: input.chainId,
      marketAddress: normalizeAddress(input.marketAddress),
      status: MarketStatus.Created,
    },
    data: {
      status: MarketStatus.Open,
    },
  });
}

export async function applyMarketResolvedProjection(
  tx: Prisma.TransactionClient,
  input: {
    chainId: number;
    marketAddress: string;
    outcome: bigint;
    blockNumber: bigint;
    txHash: string;
  }
): Promise<MarketResolution> {
  const resolution = parseResolvedMarketOutcome(input.outcome);

  await tx.market.update({
    where: {
      chainId_marketAddress: {
        chainId: input.chainId,
        marketAddress: normalizeAddress(input.marketAddress),
      },
    },
    data: {
      status: resolution.status,
      outcome: resolution.outcome,
      resolvedBlockNumber: input.blockNumber,
      resolvedTxHash: input.txHash,
    },
  });

  return resolution;
}
