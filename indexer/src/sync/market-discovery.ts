import {
  MarketOutcome,
  MarketStatus,
  type Prisma,
} from "@prisma/client";

export interface DiscoveredMarketInput {
  chainId: number;
  marketId: bigint;
  marketAddress: string;
  factoryAddress: string;
  createdBlockNumber: bigint;
  createdTxHash: string;
  createdLogIndex: number;
}

export async function upsertDiscoveredMarket(
  tx: Prisma.TransactionClient,
  input: DiscoveredMarketInput
): Promise<string> {
  const marketAddress = input.marketAddress.toLowerCase();
  const factoryAddress = input.factoryAddress.toLowerCase();

  await tx.market.upsert({
    where: {
      chainId_marketAddress: {
        chainId: input.chainId,
        marketAddress,
      },
    },
    create: {
      chainId: input.chainId,
      marketId: input.marketId,
      marketAddress,
      factoryAddress,
      createdBlockNumber: input.createdBlockNumber,
      createdTxHash: input.createdTxHash,
      createdLogIndex: input.createdLogIndex,
      status: MarketStatus.Created,
      outcome: MarketOutcome.Unresolved,
    },
    update: {
      marketId: input.marketId,
      factoryAddress,
      createdBlockNumber: input.createdBlockNumber,
      createdTxHash: input.createdTxHash,
      createdLogIndex: input.createdLogIndex,
    },
  });

  return marketAddress;
}
