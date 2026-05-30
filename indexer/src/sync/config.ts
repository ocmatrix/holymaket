import { CONTRACTS } from "../config/contracts.js";
import { getEnv, requireEnv } from "../config/env.js";

function parseIntegerEnv(key: string, fallback: string): number {
  const rawValue = getEnv(key, fallback);
  const value = Number(rawValue);

  if (!Number.isInteger(value) || value < 0) {
    throw new Error(
      `Invalid ${key}: expected a non-negative integer, received "${rawValue}"`
    );
  }

  return value;
}

function parsePositiveIntegerEnv(key: string, fallback: string): number {
  const value = parseIntegerEnv(key, fallback);

  if (value === 0) {
    throw new Error(`Invalid ${key}: expected a positive integer`);
  }

  return value;
}

export const syncConfig = {
  databaseUrl: requireEnv("DATABASE_URL"),
  startBlock: BigInt(parseIntegerEnv("INDEXER_START_BLOCK", "0")),
  confirmations: parseIntegerEnv("INDEXER_CONFIRMATIONS", "12"),
  batchSize: parsePositiveIntegerEnv("INDEXER_BATCH_SIZE", "5000"),
  maxBlocksPerRun: parsePositiveIntegerEnv("INDEXER_MAX_BLOCKS_PER_RUN", "20000"),
  scope: "factory",
  contractAddress: CONTRACTS.MARKET_FACTORY.toLowerCase(),
} as const;
