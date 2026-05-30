import { publicClient } from "../lib/public-client.js";

export function requireLogField<T>(
  value: T | null | undefined,
  fieldName: string,
  eventName: string
): T {
  if (value === null || value === undefined) {
    throw new Error(`${eventName} log missing required field: ${fieldName}`);
  }

  return value;
}

function timestampToDate(timestamp: bigint): Date {
  return new Date(Number(timestamp) * 1000);
}

export async function getBlockTimestamp(
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
