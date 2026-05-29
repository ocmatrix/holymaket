import dotenv from "dotenv";
import { resolve } from "node:path";

dotenv.config({ path: resolve(import.meta.dirname, "../../.env") });

export function requireEnv(key: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getEnv(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const BSC_TESTNET_RPC_URL = getEnv(
  "BSC_TESTNET_RPC_URL",
  "https://data-seed-prebsc-1-s1.bnbchain.org:8545"
);

export const INDEXER_CHAIN_ID = Number(
  getEnv("INDEXER_CHAIN_ID", "97")
);
