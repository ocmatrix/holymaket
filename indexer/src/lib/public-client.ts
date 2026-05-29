import { createPublicClient, http } from "viem";
import { INDEXER_CHAIN } from "../config/chains.js";
import { BSC_TESTNET_RPC_URL } from "../config/env.js";

export const publicClient = createPublicClient({
  chain: INDEXER_CHAIN,
  transport: http(BSC_TESTNET_RPC_URL),
});
