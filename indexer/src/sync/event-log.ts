import type { Prisma } from "@prisma/client";

export interface IndexerEventLogInput {
  chainId: number;
  contractAddress: string;
  eventName: string;
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockHash?: string;
  blockTimestamp?: Date;
}

export async function writeIndexerEventLogIdempotently(
  tx: Prisma.TransactionClient,
  input: IndexerEventLogInput
): Promise<"inserted" | "skipped_duplicate"> {
  const result = await tx.indexerEventLog.createMany({
    data: [
      {
        chainId: input.chainId,
        contractAddress: input.contractAddress.toLowerCase(),
        eventName: input.eventName,
        txHash: input.txHash,
        logIndex: input.logIndex,
        blockNumber: input.blockNumber,
        blockHash: input.blockHash,
        blockTimestamp: input.blockTimestamp,
      },
    ],
    skipDuplicates: true,
  });

  return result.count === 0 ? "skipped_duplicate" : "inserted";
}
