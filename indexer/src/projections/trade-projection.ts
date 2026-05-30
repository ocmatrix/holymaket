import {
  TradeAction,
  TradeSide,
  type Prisma,
} from "@prisma/client";

import { normalizeAddress } from "../lib/address.js";

export function parseTradeSide(side: bigint): TradeSide {
  if (side === 1n) {
    return TradeSide.Yes;
  }

  if (side === 2n) {
    return TradeSide.No;
  }

  throw new Error(`Unsupported trade side: ${side}`);
}

export async function insertTradeProjection(
  tx: Prisma.TransactionClient,
  input: {
    chainId: number;
    marketAddress: string;
    userAddress: string;
    side: TradeSide;
    action: TradeAction;
    collateralAmount: bigint;
    sharesAmount: bigint;
    feeAmount?: bigint;
    txHash: string;
    logIndex: number;
    blockNumber: bigint;
    blockTimestamp?: Date;
  }
): Promise<void> {
  await tx.trade.createMany({
    data: [
      {
        chainId: input.chainId,
        marketAddress: normalizeAddress(input.marketAddress),
        userAddress: normalizeAddress(input.userAddress),
        side: input.side,
        action: input.action,
        collateralAmount: input.collateralAmount.toString(),
        sharesAmount: input.sharesAmount.toString(),
        feeAmount:
          input.feeAmount === undefined
            ? null
            : input.feeAmount.toString(),
        txHash: input.txHash,
        logIndex: input.logIndex,
        blockNumber: input.blockNumber,
        blockTimestamp: input.blockTimestamp,
      },
    ],
    skipDuplicates: true,
  });
}

export { TradeAction, TradeSide };
