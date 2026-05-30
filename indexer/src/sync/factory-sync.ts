import { prisma } from "../lib/prisma.js";
import { publicClient } from "../lib/public-client.js";
import { MARKET_CREATED_EVENT } from "../abi/market-factory.js";
import { INDEXER_CHAIN } from "../config/chains.js";
import { CONTRACTS } from "../config/contracts.js";
import { planBlockRanges } from "./block-range.js";
import { syncConfig } from "./config.js";
import { writeIndexerEventLogIdempotently } from "./event-log.js";
import { getNextFactoryBlock, updateFactoryState } from "./indexer-state.js";
import { upsertDiscoveredMarket } from "./market-discovery.js";

interface BatchSyncResult {
  fromBlock: bigint;
  toBlock: bigint;
  marketCreatedCount: number;
  insertedEventLogs: number;
  skippedEventLogs: number;
  upsertedMarkets: number;
}

export interface FactorySyncResult {
  latestBlock: bigint;
  safeToBlock: bigint;
  fromBlock: bigint;
  targetToBlock: bigint | null;
  batches: BatchSyncResult[];
}

function requireLogField<T>(
  value: T | null | undefined,
  fieldName: string
): T {
  if (value === null || value === undefined) {
    throw new Error(`MarketCreated log missing required field: ${fieldName}`);
  }

  return value;
}

function timestampToDate(timestamp: bigint): Date {
  return new Date(Number(timestamp) * 1000);
}

async function getBlockTimestamp(
  blockHash: string | undefined,
  cache: Map<string, Date>
): Promise<Date | undefined> {
  if (blockHash === undefined) {
    return undefined;
  }

  const normalizedBlockHash = blockHash.toLowerCase();
  const cached = cache.get(normalizedBlockHash);
  if (cached) {
    return cached;
  }

  const block = await publicClient.getBlock({
    blockHash: blockHash as `0x${string}`,
  });
  const timestamp = timestampToDate(block.timestamp);

  cache.set(normalizedBlockHash, timestamp);
  return timestamp;
}

export async function runFactorySync(): Promise<FactorySyncResult> {
  const factoryAddress = CONTRACTS.MARKET_FACTORY;
  const factoryAddressLower = factoryAddress.toLowerCase();
  const chainId = INDEXER_CHAIN.id;

  const latestBlock = await publicClient.getBlockNumber();
  const fromBlock = await getNextFactoryBlock({
    prisma,
    chainId,
    scope: syncConfig.scope,
    contractAddress: syncConfig.contractAddress,
    startBlock: syncConfig.startBlock,
  });

  const plannedRanges = planBlockRanges({
    fromBlock,
    latestBlock,
    confirmations: syncConfig.confirmations,
    batchSize: syncConfig.batchSize,
    maxBlocksPerRun: syncConfig.maxBlocksPerRun,
  });

  console.log(`Factory: ${factoryAddress}`);
  console.log(`Latest block: ${latestBlock}`);
  console.log(`Safe to block: ${plannedRanges.safeToBlock}`);
  console.log(`Start block: ${fromBlock}`);
  console.log(`Batch size: ${syncConfig.batchSize}`);

  if (plannedRanges.targetToBlock === null) {
    console.log("No new safe blocks to index.");

    return {
      latestBlock,
      safeToBlock: plannedRanges.safeToBlock,
      fromBlock,
      targetToBlock: null,
      batches: [],
    };
  }

  const results: BatchSyncResult[] = [];

  for (const batch of plannedRanges.batches) {
    console.log(`Scanning factory blocks ${batch.fromBlock} - ${batch.toBlock}`);

    const logs = await publicClient.getLogs({
      address: factoryAddress,
      event: MARKET_CREATED_EVENT,
      fromBlock: batch.fromBlock,
      toBlock: batch.toBlock,
    });

    const blockTimestampCache = new Map<string, Date>();

    const batchResult = await prisma.$transaction(async (tx) => {
      let insertedEventLogs = 0;
      let skippedEventLogs = 0;
      let upsertedMarkets = 0;

      for (const log of logs) {
        const txHash = requireLogField(log.transactionHash, "transactionHash");
        const logIndex = requireLogField(log.logIndex, "logIndex");
        const blockNumber = requireLogField(log.blockNumber, "blockNumber");
        const marketId = requireLogField(log.args.marketId, "marketId");
        const marketAddress = requireLogField(
          log.args.marketAddress,
          "marketAddress"
        );
        const blockTimestamp = await getBlockTimestamp(
          log.blockHash ?? undefined,
          blockTimestampCache
        );

        console.log(
          `Found MarketCreated: marketId=${marketId} market=${marketAddress}`
        );

        const eventLogStatus = await writeIndexerEventLogIdempotently(tx, {
          chainId,
          contractAddress: factoryAddressLower,
          eventName: "MarketCreated",
          txHash,
          logIndex,
          blockNumber,
          blockHash: log.blockHash ?? undefined,
          blockTimestamp,
        });

        if (eventLogStatus === "inserted") {
          insertedEventLogs += 1;
        } else {
          skippedEventLogs += 1;
        }

        console.log(
          `Saved IndexerEventLog: MarketCreated tx=${txHash} (${eventLogStatus})`
        );

        const normalizedMarketAddress = await upsertDiscoveredMarket(tx, {
          chainId,
          marketId,
          marketAddress,
          factoryAddress: factoryAddressLower,
          createdBlockNumber: blockNumber,
          createdTxHash: txHash,
          createdLogIndex: logIndex,
        });

        upsertedMarkets += 1;
        console.log(`Upserted Market: ${normalizedMarketAddress}`);
      }

      await updateFactoryState({
        tx,
        chainId,
        scope: syncConfig.scope,
        contractAddress: syncConfig.contractAddress,
        lastIndexedBlock: batch.toBlock,
      });

      console.log(`Updated IndexerState: lastIndexedBlock=${batch.toBlock}`);

      return {
        fromBlock: batch.fromBlock,
        toBlock: batch.toBlock,
        marketCreatedCount: logs.length,
        insertedEventLogs,
        skippedEventLogs,
        upsertedMarkets,
      };
    });

    results.push(batchResult);
  }

  return {
    latestBlock,
    safeToBlock: plannedRanges.safeToBlock,
    fromBlock,
    targetToBlock: plannedRanges.targetToBlock,
    batches: results,
  };
}
