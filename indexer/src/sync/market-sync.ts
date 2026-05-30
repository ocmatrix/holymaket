import { ClaimType, MarketOutcome } from "@prisma/client";

import {
  FEE_COLLECTED_EVENT,
  MARKET_RESOLVED_EVENT,
  POSITION_BOUGHT_EVENT,
  POSITION_SOLD_EVENT,
  REFUND_CLAIMED_EVENT,
  RESERVES_UPDATED_EVENT,
  REWARD_CLAIMED_EVENT,
  TREASURY_REFUND_CLAIMED_EVENT,
} from "../abi/binary-prediction-market.js";
import { INDEXER_CHAIN } from "../config/chains.js";
import { normalizeAddress } from "../lib/address.js";
import { prisma } from "../lib/prisma.js";
import { publicClient } from "../lib/public-client.js";
import { insertClaimProjection } from "../projections/claim-projection.js";
import {
  applyMarketResolvedProjection,
  markMarketOpenIfCreated,
} from "../projections/market-projection.js";
import {
  applyTradeToUserPosition,
  markUserPositionClaimed,
  markUserPositionRefunded,
} from "../projections/position-aggregation.js";
import { insertReserveSnapshotProjection } from "../projections/reserve-projection.js";
import {
  insertTradeProjection,
  parseTradeSide,
  TradeAction,
} from "../projections/trade-projection.js";
import { planBlockRanges } from "./block-range.js";
import { syncConfig } from "./config.js";
import { writeIndexerEventLogIdempotently } from "./event-log.js";
import { getNextIndexedBlock, updateIndexedState } from "./indexer-state.js";
import { getBlockTimestamp, requireLogField } from "./log-utils.js";

type BinaryOutcome = "Yes" | "No";

interface BaseMarketEvent {
  eventName:
    | "PositionBought"
    | "PositionSold"
    | "MarketResolved"
    | "RewardClaimed"
    | "RefundClaimed"
    | "TreasuryRefundClaimed"
    | "ReservesUpdated"
    | "FeeCollected";
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockHash?: string;
}

type MarketEvent =
  | (BaseMarketEvent & {
      eventName: "PositionBought";
      payload: {
        userAddress: string;
        side: ReturnType<typeof parseTradeSide>;
        collateralAmount: bigint;
        sharesAmount: bigint;
        feeAmount: bigint;
      };
    })
  | (BaseMarketEvent & {
      eventName: "PositionSold";
      payload: {
        userAddress: string;
        side: ReturnType<typeof parseTradeSide>;
        collateralAmount: bigint;
        sharesAmount: bigint;
        feeAmount: bigint;
      };
    })
  | (BaseMarketEvent & {
      eventName: "MarketResolved";
      payload: {
        outcome: bigint;
      };
    })
  | (BaseMarketEvent & {
      eventName: "RewardClaimed";
      payload: {
        userAddress: string;
        amount: bigint;
      };
    })
  | (BaseMarketEvent & {
      eventName: "RefundClaimed";
      payload: {
        userAddress: string;
        amount: bigint;
      };
    })
  | (BaseMarketEvent & {
      eventName: "TreasuryRefundClaimed";
      payload: {
        amount: bigint;
      };
    })
  | (BaseMarketEvent & {
      eventName: "ReservesUpdated";
      payload: {
        yesReserve: bigint;
        noReserve: bigint;
      };
    })
  | (BaseMarketEvent & {
      eventName: "FeeCollected";
      payload: {
        amount: bigint;
      };
    });

interface MarketBatchSyncResult {
  fromBlock: bigint;
  toBlock: bigint;
  eventCount: number;
  insertedEventLogs: number;
  skippedEventLogs: number;
}

interface MarketSyncEntryResult {
  marketAddress: string;
  fromBlock: bigint;
  targetToBlock: bigint | null;
  batches: MarketBatchSyncResult[];
}

export interface MarketSyncResult {
  latestBlock: bigint;
  safeToBlock: bigint;
  markets: MarketSyncEntryResult[];
}

function toBigInt(value: bigint | number): bigint {
  return BigInt(value);
}

function sortMarketEvents(left: MarketEvent, right: MarketEvent): number {
  if (left.blockNumber < right.blockNumber) {
    return -1;
  }

  if (left.blockNumber > right.blockNumber) {
    return 1;
  }

  return left.logIndex - right.logIndex;
}

async function getBinaryMarketOutcome(
  tx: Parameters<typeof prisma.$transaction>[0] extends (
    db: infer T
  ) => Promise<unknown>
    ? T
    : never,
  chainId: number,
  marketAddress: string
): Promise<BinaryOutcome> {
  const market = await tx.market.findUnique({
    where: {
      chainId_marketAddress: {
        chainId,
        marketAddress: normalizeAddress(marketAddress),
      },
    },
    select: {
      outcome: true,
    },
  });

  if (market?.outcome === MarketOutcome.Yes) {
    return "Yes";
  }

  if (market?.outcome === MarketOutcome.No) {
    return "No";
  }

  throw new Error(
    `RewardClaimed encountered before a binary MarketResolved projection for ${marketAddress}`
  );
}

async function fetchMarketEvents(
  marketAddress: string,
  fromBlock: bigint,
  toBlock: bigint
): Promise<MarketEvent[]> {
  const address = marketAddress as `0x${string}`;
  const [
    boughtLogs,
    soldLogs,
    resolvedLogs,
    rewardClaimedLogs,
    refundClaimedLogs,
    treasuryRefundClaimedLogs,
    reservesUpdatedLogs,
    feeCollectedLogs,
  ] = await Promise.all([
    publicClient.getLogs({
      address,
      event: POSITION_BOUGHT_EVENT,
      fromBlock,
      toBlock,
    }),
    publicClient.getLogs({
      address,
      event: POSITION_SOLD_EVENT,
      fromBlock,
      toBlock,
    }),
    publicClient.getLogs({
      address,
      event: MARKET_RESOLVED_EVENT,
      fromBlock,
      toBlock,
    }),
    publicClient.getLogs({
      address,
      event: REWARD_CLAIMED_EVENT,
      fromBlock,
      toBlock,
    }),
    publicClient.getLogs({
      address,
      event: REFUND_CLAIMED_EVENT,
      fromBlock,
      toBlock,
    }),
    publicClient.getLogs({
      address,
      event: TREASURY_REFUND_CLAIMED_EVENT,
      fromBlock,
      toBlock,
    }),
    publicClient.getLogs({
      address,
      event: RESERVES_UPDATED_EVENT,
      fromBlock,
      toBlock,
    }),
    publicClient.getLogs({
      address,
      event: FEE_COLLECTED_EVENT,
      fromBlock,
      toBlock,
    }),
  ]);

  const events: MarketEvent[] = [];

  for (const log of boughtLogs) {
    events.push({
      eventName: "PositionBought",
      txHash: requireLogField(
        log.transactionHash,
        "transactionHash",
        "PositionBought"
      ),
      logIndex: requireLogField(log.logIndex, "logIndex", "PositionBought"),
      blockNumber: requireLogField(
        log.blockNumber,
        "blockNumber",
        "PositionBought"
      ),
      blockHash: log.blockHash ?? undefined,
      payload: {
        userAddress: requireLogField(log.args.user, "user", "PositionBought"),
        side: parseTradeSide(
          toBigInt(requireLogField(log.args.side, "side", "PositionBought"))
        ),
        collateralAmount: requireLogField(
          log.args.collateralIn,
          "collateralIn",
          "PositionBought"
        ),
        sharesAmount: requireLogField(
          log.args.sharesOut,
          "sharesOut",
          "PositionBought"
        ),
        feeAmount: requireLogField(log.args.fee, "fee", "PositionBought"),
      },
    });
  }

  for (const log of soldLogs) {
    events.push({
      eventName: "PositionSold",
      txHash: requireLogField(
        log.transactionHash,
        "transactionHash",
        "PositionSold"
      ),
      logIndex: requireLogField(log.logIndex, "logIndex", "PositionSold"),
      blockNumber: requireLogField(log.blockNumber, "blockNumber", "PositionSold"),
      blockHash: log.blockHash ?? undefined,
      payload: {
        userAddress: requireLogField(log.args.user, "user", "PositionSold"),
        side: parseTradeSide(
          toBigInt(requireLogField(log.args.side, "side", "PositionSold"))
        ),
        collateralAmount: requireLogField(
          log.args.collateralOut,
          "collateralOut",
          "PositionSold"
        ),
        sharesAmount: requireLogField(
          log.args.sharesIn,
          "sharesIn",
          "PositionSold"
        ),
        feeAmount: requireLogField(log.args.fee, "fee", "PositionSold"),
      },
    });
  }

  for (const log of resolvedLogs) {
    events.push({
      eventName: "MarketResolved",
      txHash: requireLogField(
        log.transactionHash,
        "transactionHash",
        "MarketResolved"
      ),
      logIndex: requireLogField(log.logIndex, "logIndex", "MarketResolved"),
      blockNumber: requireLogField(
        log.blockNumber,
        "blockNumber",
        "MarketResolved"
      ),
      blockHash: log.blockHash ?? undefined,
      payload: {
        outcome: toBigInt(
          requireLogField(log.args.outcome, "outcome", "MarketResolved")
        ),
      },
    });
  }

  for (const log of rewardClaimedLogs) {
    events.push({
      eventName: "RewardClaimed",
      txHash: requireLogField(
        log.transactionHash,
        "transactionHash",
        "RewardClaimed"
      ),
      logIndex: requireLogField(log.logIndex, "logIndex", "RewardClaimed"),
      blockNumber: requireLogField(
        log.blockNumber,
        "blockNumber",
        "RewardClaimed"
      ),
      blockHash: log.blockHash ?? undefined,
      payload: {
        userAddress: requireLogField(log.args.user, "user", "RewardClaimed"),
        amount: requireLogField(log.args.payout, "payout", "RewardClaimed"),
      },
    });
  }

  for (const log of refundClaimedLogs) {
    events.push({
      eventName: "RefundClaimed",
      txHash: requireLogField(
        log.transactionHash,
        "transactionHash",
        "RefundClaimed"
      ),
      logIndex: requireLogField(log.logIndex, "logIndex", "RefundClaimed"),
      blockNumber: requireLogField(
        log.blockNumber,
        "blockNumber",
        "RefundClaimed"
      ),
      blockHash: log.blockHash ?? undefined,
      payload: {
        userAddress: requireLogField(log.args.user, "user", "RefundClaimed"),
        amount: requireLogField(
          log.args.refundAmount,
          "refundAmount",
          "RefundClaimed"
        ),
      },
    });
  }

  for (const log of treasuryRefundClaimedLogs) {
    events.push({
      eventName: "TreasuryRefundClaimed",
      txHash: requireLogField(
        log.transactionHash,
        "transactionHash",
        "TreasuryRefundClaimed"
      ),
      logIndex: requireLogField(
        log.logIndex,
        "logIndex",
        "TreasuryRefundClaimed"
      ),
      blockNumber: requireLogField(
        log.blockNumber,
        "blockNumber",
        "TreasuryRefundClaimed"
      ),
      blockHash: log.blockHash ?? undefined,
      payload: {
        amount: requireLogField(
          log.args.refundAmount,
          "refundAmount",
          "TreasuryRefundClaimed"
        ),
      },
    });
  }

  for (const log of reservesUpdatedLogs) {
    events.push({
      eventName: "ReservesUpdated",
      txHash: requireLogField(
        log.transactionHash,
        "transactionHash",
        "ReservesUpdated"
      ),
      logIndex: requireLogField(log.logIndex, "logIndex", "ReservesUpdated"),
      blockNumber: requireLogField(
        log.blockNumber,
        "blockNumber",
        "ReservesUpdated"
      ),
      blockHash: log.blockHash ?? undefined,
      payload: {
        yesReserve: requireLogField(log.args.yes, "yes", "ReservesUpdated"),
        noReserve: requireLogField(log.args.no, "no", "ReservesUpdated"),
      },
    });
  }

  for (const log of feeCollectedLogs) {
    events.push({
      eventName: "FeeCollected",
      txHash: requireLogField(
        log.transactionHash,
        "transactionHash",
        "FeeCollected"
      ),
      logIndex: requireLogField(log.logIndex, "logIndex", "FeeCollected"),
      blockNumber: requireLogField(log.blockNumber, "blockNumber", "FeeCollected"),
      blockHash: log.blockHash ?? undefined,
      payload: {
        amount: requireLogField(log.args.amount, "amount", "FeeCollected"),
      },
    });
  }

  return events.sort(sortMarketEvents);
}

export async function runMarketSync(): Promise<MarketSyncResult> {
  const chainId = INDEXER_CHAIN.id;
  const latestBlock = await publicClient.getBlockNumber();
  const knownMarkets = await prisma.market.findMany({
    select: {
      marketAddress: true,
      createdBlockNumber: true,
    },
    orderBy: {
      createdBlockNumber: "asc",
    },
  });

  const marketResults: MarketSyncEntryResult[] = [];
  let safeToBlock = latestBlock;

  for (const market of knownMarkets) {
    const marketAddress = normalizeAddress(market.marketAddress);
    const startBlock = market.createdBlockNumber ?? syncConfig.startBlock;
    const fromBlock = await getNextIndexedBlock({
      prisma,
      chainId,
      scope: "market",
      contractAddress: marketAddress,
      startBlock,
    });
    const plannedRanges = planBlockRanges({
      fromBlock,
      latestBlock,
      confirmations: syncConfig.confirmations,
      batchSize: syncConfig.batchSize,
      maxBlocksPerRun: syncConfig.maxBlocksPerRun,
    });

    safeToBlock = plannedRanges.safeToBlock;

    console.log(`Market: ${marketAddress}`);
    console.log(`Market scope: market`);
    console.log(`Market state key: ${marketAddress}`);
    console.log(`Market start block: ${fromBlock}`);

    const result: MarketSyncEntryResult = {
      marketAddress,
      fromBlock,
      targetToBlock: plannedRanges.targetToBlock,
      batches: [],
    };

    if (plannedRanges.targetToBlock === null) {
      console.log(`No new safe blocks to index for market ${marketAddress}.`);
      marketResults.push(result);
      continue;
    }

    for (const batch of plannedRanges.batches) {
      console.log(
        `Scanning market ${marketAddress} blocks ${batch.fromBlock} - ${batch.toBlock}`
      );

      const events = await fetchMarketEvents(
        marketAddress,
        batch.fromBlock,
        batch.toBlock
      );
      const blockTimestampCache = new Map<string, Date>();

      const batchResult = await prisma.$transaction(async (tx) => {
        let insertedEventLogs = 0;
        let skippedEventLogs = 0;

        for (const event of events) {
          const blockTimestamp = await getBlockTimestamp(
            event.blockHash,
            blockTimestampCache
          );

          const eventLogStatus = await writeIndexerEventLogIdempotently(tx, {
            chainId,
            contractAddress: marketAddress,
            eventName: event.eventName,
            txHash: event.txHash,
            logIndex: event.logIndex,
            blockNumber: event.blockNumber,
            blockHash: event.blockHash,
            blockTimestamp,
          });

          if (eventLogStatus === "skipped_duplicate") {
            skippedEventLogs += 1;
            continue;
          }

          insertedEventLogs += 1;

          switch (event.eventName) {
            case "PositionBought":
              await insertTradeProjection(tx, {
                chainId,
                marketAddress,
                userAddress: event.payload.userAddress,
                side: event.payload.side,
                action: TradeAction.Buy,
                collateralAmount: event.payload.collateralAmount,
                sharesAmount: event.payload.sharesAmount,
                feeAmount: event.payload.feeAmount,
                txHash: event.txHash,
                logIndex: event.logIndex,
                blockNumber: event.blockNumber,
                blockTimestamp,
              });
              await applyTradeToUserPosition(tx, {
                chainId,
                marketAddress,
                userAddress: event.payload.userAddress,
                side: event.payload.side,
                action: TradeAction.Buy,
                sharesAmount: event.payload.sharesAmount.toString(),
                blockNumber: event.blockNumber,
              });
              await markMarketOpenIfCreated(tx, { chainId, marketAddress });
              break;
            case "PositionSold":
              await insertTradeProjection(tx, {
                chainId,
                marketAddress,
                userAddress: event.payload.userAddress,
                side: event.payload.side,
                action: TradeAction.Sell,
                collateralAmount: event.payload.collateralAmount,
                sharesAmount: event.payload.sharesAmount,
                feeAmount: event.payload.feeAmount,
                txHash: event.txHash,
                logIndex: event.logIndex,
                blockNumber: event.blockNumber,
                blockTimestamp,
              });
              await applyTradeToUserPosition(tx, {
                chainId,
                marketAddress,
                userAddress: event.payload.userAddress,
                side: event.payload.side,
                action: TradeAction.Sell,
                sharesAmount: event.payload.sharesAmount.toString(),
                blockNumber: event.blockNumber,
              });
              await markMarketOpenIfCreated(tx, { chainId, marketAddress });
              break;
            case "MarketResolved":
              await applyMarketResolvedProjection(tx, {
                chainId,
                marketAddress,
                outcome: event.payload.outcome,
                blockNumber: event.blockNumber,
                txHash: event.txHash,
              });
              break;
            case "RewardClaimed": {
              await insertClaimProjection(tx, {
                chainId,
                marketAddress,
                userAddress: event.payload.userAddress,
                type: ClaimType.Reward,
                amount: event.payload.amount,
                txHash: event.txHash,
                logIndex: event.logIndex,
                blockNumber: event.blockNumber,
                blockTimestamp,
              });
              const outcome = await getBinaryMarketOutcome(
                tx,
                chainId,
                marketAddress
              );
              await markUserPositionClaimed(tx, {
                chainId,
                marketAddress,
                userAddress: event.payload.userAddress,
                outcome,
                blockNumber: event.blockNumber,
              });
              break;
            }
            case "RefundClaimed":
              await insertClaimProjection(tx, {
                chainId,
                marketAddress,
                userAddress: event.payload.userAddress,
                type: ClaimType.Refund,
                amount: event.payload.amount,
                txHash: event.txHash,
                logIndex: event.logIndex,
                blockNumber: event.blockNumber,
                blockTimestamp,
              });
              await markUserPositionRefunded(tx, {
                chainId,
                marketAddress,
                userAddress: event.payload.userAddress,
                blockNumber: event.blockNumber,
              });
              break;
            case "TreasuryRefundClaimed":
              await insertClaimProjection(tx, {
                chainId,
                marketAddress,
                userAddress: null,
                type: ClaimType.TreasuryRefund,
                amount: event.payload.amount,
                txHash: event.txHash,
                logIndex: event.logIndex,
                blockNumber: event.blockNumber,
                blockTimestamp,
              });
              break;
            case "ReservesUpdated":
              await insertReserveSnapshotProjection(tx, {
                chainId,
                marketAddress,
                yesReserve: event.payload.yesReserve,
                noReserve: event.payload.noReserve,
                blockNumber: event.blockNumber,
                txHash: event.txHash,
                logIndex: event.logIndex,
                blockTimestamp,
              });
              await markMarketOpenIfCreated(tx, { chainId, marketAddress });
              break;
            case "FeeCollected":
              break;
          }
        }

        await updateIndexedState({
          tx,
          chainId,
          scope: "market",
          contractAddress: marketAddress,
          lastIndexedBlock: batch.toBlock,
        });

        return {
          fromBlock: batch.fromBlock,
          toBlock: batch.toBlock,
          eventCount: events.length,
          insertedEventLogs,
          skippedEventLogs,
        };
      });

      result.batches.push(batchResult);
    }

    marketResults.push(result);
  }

  return {
    latestBlock,
    safeToBlock,
    markets: marketResults,
  };
}
