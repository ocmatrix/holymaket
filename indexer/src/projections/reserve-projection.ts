import type { Prisma } from "@prisma/client";

import { normalizeAddress } from "../lib/address.js";

export async function insertReserveSnapshotProjection(
  tx: Prisma.TransactionClient,
  input: {
    chainId: number;
    marketAddress: string;
    yesReserve: bigint;
    noReserve: bigint;
    blockNumber: bigint;
    txHash: string;
    logIndex: number;
    blockTimestamp?: Date;
  }
): Promise<void> {
  await tx.reserveSnapshot.createMany({
    data: [
      {
        chainId: input.chainId,
        marketAddress: normalizeAddress(input.marketAddress),
        yesReserve: input.yesReserve.toString(),
        noReserve: input.noReserve.toString(),
        blockNumber: input.blockNumber,
        txHash: input.txHash,
        logIndex: input.logIndex,
        blockTimestamp: input.blockTimestamp,
      },
    ],
    skipDuplicates: true,
  });
}
