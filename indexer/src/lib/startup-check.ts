import { parseAbi } from "viem";
import { publicClient } from "./public-client.js";
import { CONTRACTS } from "../config/contracts.js";
import { INDEXER_CHAIN } from "../config/chains.js";

const MARKET_FACTORY_MINIMAL_ABI = parseAbi([
  "function ammEngine() view returns (address)",
  "function nextMarketId() view returns (uint256)",
]);

export async function runStartupCheck(): Promise<boolean> {
  console.log("XMarket Indexer Bootstrap");
  console.log(`Chain: ${INDEXER_CHAIN.name}`);

  const chainId = await publicClient.getChainId();
  console.log(`Connected chainId: ${chainId}`);

  if (chainId !== INDEXER_CHAIN.id) {
    console.error(
      `Chain ID mismatch: expected ${INDEXER_CHAIN.id}, got ${chainId}`
    );
    return false;
  }

  console.log(`MarketFactory: ${CONTRACTS.MARKET_FACTORY}`);

  const [ammEngine, nextMarketId] = await publicClient.multicall({
    contracts: [
      {
        address: CONTRACTS.MARKET_FACTORY,
        abi: MARKET_FACTORY_MINIMAL_ABI,
        functionName: "ammEngine",
      },
      {
        address: CONTRACTS.MARKET_FACTORY,
        abi: MARKET_FACTORY_MINIMAL_ABI,
        functionName: "nextMarketId",
      },
    ],
  });

  if (ammEngine.status !== "success" || nextMarketId.status !== "success") {
    console.error("Failed to read MarketFactory on-chain data");
    return false;
  }

  const engineAddress = ammEngine.result as string;
  console.log(`Factory ammEngine: ${engineAddress}`);

  if (engineAddress.toLowerCase() !== CONTRACTS.CPMM_ENGINE.toLowerCase()) {
    console.error(
      `ammEngine mismatch: expected ${CONTRACTS.CPMM_ENGINE}, got ${engineAddress}`
    );
    return false;
  }

  console.log(`Factory nextMarketId: ${nextMarketId.result}`);

  console.log("Indexer bootstrap ready");
  return true;
}
