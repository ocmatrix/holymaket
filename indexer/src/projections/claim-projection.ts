import { ClaimType, type Prisma } from "@prisma/client";

import { normalizeAddress, normalizeOptionalAddress } from "../lib/address.js";

export async function insertClaimProjection(
  tx: Prisma.TransactionClient,
  input: {
    chainId: number;
    marketAddress: string;
    userAddress?: string | null;
    type: ClaimType;
    amount: bigint;
    txHash: string;
    logIndex: number;
    blockNumber: bigint;
    blockTimestamp?: Date;
  }
): Promise<void> {
  await tx.claim.createMany({
    data: [
      {
        chainId: input.chainId,
        marketAddress: normalizeAddress(input.marketAddress),
        userAddress: normalizeOptionalAddress(input.userAddress),
        type: input.type,
        amount: input.amount.toString(),
        txHash: input.txHash,
        logIndex: input.logIndex,
        blockNumber: input.blockNumber,
        blockTimestamp: input.blockTimestamp,
      },
    ],
    skipDuplicates: true,
  });
}

export { ClaimType };
