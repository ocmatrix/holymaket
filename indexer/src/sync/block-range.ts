export interface BlockRange {
  fromBlock: bigint;
  toBlock: bigint;
}

export interface PlannedBlockRanges {
  safeToBlock: bigint;
  targetToBlock: bigint | null;
  batches: BlockRange[];
}

function minBigInt(left: bigint, right: bigint): bigint {
  return left < right ? left : right;
}

export function computeSafeToBlock(
  latestBlock: bigint,
  confirmations: number
): bigint {
  const confirmationWindow = BigInt(confirmations);
  return latestBlock > confirmationWindow ? latestBlock - confirmationWindow : 0n;
}

export function planBlockRanges(params: {
  fromBlock: bigint;
  latestBlock: bigint;
  confirmations: number;
  batchSize: number;
  maxBlocksPerRun: number;
}): PlannedBlockRanges {
  const {
    fromBlock,
    latestBlock,
    confirmations,
    batchSize,
    maxBlocksPerRun,
  } = params;

  const safeToBlock = computeSafeToBlock(latestBlock, confirmations);

  if (fromBlock > safeToBlock) {
    return {
      safeToBlock,
      targetToBlock: null,
      batches: [],
    };
  }

  const targetToBlock = minBigInt(
    safeToBlock,
    fromBlock + BigInt(maxBlocksPerRun) - 1n
  );

  const batches: BlockRange[] = [];
  const batchSizeBigInt = BigInt(batchSize);

  for (
    let batchFrom = fromBlock;
    batchFrom <= targetToBlock;
    batchFrom += batchSizeBigInt
  ) {
    const batchTo = minBigInt(
      batchFrom + batchSizeBigInt - 1n,
      targetToBlock
    );

    batches.push({
      fromBlock: batchFrom,
      toBlock: batchTo,
    });
  }

  return {
    safeToBlock,
    targetToBlock,
    batches,
  };
}
