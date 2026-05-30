import { parseAbiItem } from "viem";

// PR-19C event-sync-only minimal ABI fragment. Do not modify exported ABI JSON in this PR.
export const MARKET_CREATED_EVENT = parseAbiItem(
  "event MarketCreated(uint256 indexed marketId, address indexed marketAddress, address indexed creator, string question, address collateral, uint64 startTime, uint64 endTime, uint256 initialCollateral, uint16 initialPriceYesBps)"
);
