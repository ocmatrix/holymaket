import type { Prisma, TradeAction, TradeSide } from "@prisma/client";

import { normalizeAddress } from "../lib/address.js";

export interface PositionSnapshot {
  yesShares: string;
  noShares: string;
  claimed: boolean;
  refunded: boolean;
}

interface TradePositionInput {
  side: TradeSide | "Yes" | "No";
  action: TradeAction | "Buy" | "Sell";
  sharesAmount: string;
}

function getEmptyPosition(): PositionSnapshot {
  return {
    yesShares: "0",
    noShares: "0",
    claimed: false,
    refunded: false,
  };
}

function addBigIntStrings(left: string, right: string): string {
  return (BigInt(left) + BigInt(right)).toString();
}

function subtractBigIntStrings(left: string, right: string): string {
  const result = BigInt(left) - BigInt(right);
  if (result < 0n) {
    throw new Error(`Negative bigint string result: ${left} - ${right}`);
  }
  return result.toString();
}

export function applyTradeToPosition(
  snapshot: PositionSnapshot,
  input: TradePositionInput
): PositionSnapshot {
  const next = { ...snapshot };
  const shareKey = input.side === "Yes" ? "yesShares" : "noShares";

  next[shareKey] =
    input.action === "Buy"
      ? addBigIntStrings(next[shareKey], input.sharesAmount)
      : subtractBigIntStrings(next[shareKey], input.sharesAmount);

  return next;
}

export function applyRewardClaimToPosition(
  snapshot: PositionSnapshot,
  outcome: "Yes" | "No"
): PositionSnapshot {
  return {
    ...snapshot,
    yesShares: outcome === "Yes" ? "0" : snapshot.yesShares,
    noShares: outcome === "No" ? "0" : snapshot.noShares,
    claimed: true,
  };
}

export function applyRefundClaimToPosition(
  snapshot: PositionSnapshot
): PositionSnapshot {
  return {
    ...snapshot,
    yesShares: "0",
    noShares: "0",
    refunded: true,
  };
}

async function getCurrentPosition(
  tx: Prisma.TransactionClient,
  chainId: number,
  marketAddress: string,
  userAddress: string
) {
  return tx.userPosition.findUnique({
    where: {
      chainId_marketAddress_userAddress: {
        chainId,
        marketAddress,
        userAddress,
      },
    },
  });
}

export async function applyTradeToUserPosition(
  tx: Prisma.TransactionClient,
  input: {
    chainId: number;
    marketAddress: string;
    userAddress: string;
    side: TradeSide;
    action: TradeAction;
    sharesAmount: string;
    blockNumber: bigint;
  }
): Promise<void> {
  const marketAddress = normalizeAddress(input.marketAddress);
  const userAddress = normalizeAddress(input.userAddress);
  const current =
    (await getCurrentPosition(tx, input.chainId, marketAddress, userAddress)) ??
    {
      ...getEmptyPosition(),
      chainId: input.chainId,
      marketAddress,
      userAddress,
    };

  const next = applyTradeToPosition(current, input);

  await tx.userPosition.upsert({
    where: {
      chainId_marketAddress_userAddress: {
        chainId: input.chainId,
        marketAddress,
        userAddress,
      },
    },
    create: {
      chainId: input.chainId,
      marketAddress,
      userAddress,
      yesShares: next.yesShares,
      noShares: next.noShares,
      claimed: next.claimed,
      refunded: next.refunded,
      lastBlockNumber: input.blockNumber,
    },
    update: {
      yesShares: next.yesShares,
      noShares: next.noShares,
      claimed: next.claimed,
      refunded: next.refunded,
      lastBlockNumber: input.blockNumber,
    },
  });
}

export async function markUserPositionClaimed(
  tx: Prisma.TransactionClient,
  input: {
    chainId: number;
    marketAddress: string;
    userAddress: string;
    outcome: "Yes" | "No";
    blockNumber: bigint;
  }
): Promise<void> {
  const marketAddress = normalizeAddress(input.marketAddress);
  const userAddress = normalizeAddress(input.userAddress);
  const current =
    (await getCurrentPosition(tx, input.chainId, marketAddress, userAddress)) ??
    {
      ...getEmptyPosition(),
      chainId: input.chainId,
      marketAddress,
      userAddress,
    };

  const next = applyRewardClaimToPosition(current, input.outcome);

  await tx.userPosition.upsert({
    where: {
      chainId_marketAddress_userAddress: {
        chainId: input.chainId,
        marketAddress,
        userAddress,
      },
    },
    create: {
      chainId: input.chainId,
      marketAddress,
      userAddress,
      yesShares: next.yesShares,
      noShares: next.noShares,
      claimed: next.claimed,
      refunded: next.refunded,
      lastBlockNumber: input.blockNumber,
    },
    update: {
      yesShares: next.yesShares,
      noShares: next.noShares,
      claimed: next.claimed,
      refunded: next.refunded,
      lastBlockNumber: input.blockNumber,
    },
  });
}

export async function markUserPositionRefunded(
  tx: Prisma.TransactionClient,
  input: {
    chainId: number;
    marketAddress: string;
    userAddress: string;
    blockNumber: bigint;
  }
): Promise<void> {
  const marketAddress = normalizeAddress(input.marketAddress);
  const userAddress = normalizeAddress(input.userAddress);
  const current =
    (await getCurrentPosition(tx, input.chainId, marketAddress, userAddress)) ??
    {
      ...getEmptyPosition(),
      chainId: input.chainId,
      marketAddress,
      userAddress,
    };

  const next = applyRefundClaimToPosition(current);

  await tx.userPosition.upsert({
    where: {
      chainId_marketAddress_userAddress: {
        chainId: input.chainId,
        marketAddress,
        userAddress,
      },
    },
    create: {
      chainId: input.chainId,
      marketAddress,
      userAddress,
      yesShares: next.yesShares,
      noShares: next.noShares,
      claimed: next.claimed,
      refunded: next.refunded,
      lastBlockNumber: input.blockNumber,
    },
    update: {
      yesShares: next.yesShares,
      noShares: next.noShares,
      claimed: next.claimed,
      refunded: next.refunded,
      lastBlockNumber: input.blockNumber,
    },
  });
}
