import { parseAbi } from "viem";

export const BINARY_PREDICTION_MARKET_EVENTS = parseAbi([
  "event PositionBought(uint256 indexed marketId, address indexed user, uint8 side, uint256 collateralIn, uint256 sharesOut, uint256 fee, uint256 priceAfter)",
  "event PositionSold(uint256 indexed marketId, address indexed user, uint8 side, uint256 sharesIn, uint256 collateralOut, uint256 fee, uint256 priceAfter)",
  "event MarketResolved(uint256 indexed marketId, uint8 outcome, address indexed resolver, string evidenceURI)",
  "event RewardClaimed(uint256 indexed marketId, address indexed user, uint256 payout)",
  "event RefundClaimed(uint256 indexed marketId, address indexed user, uint256 yesShares, uint256 noShares, uint256 refundAmount)",
  "event TreasuryRefundClaimed(uint256 indexed marketId, uint256 refundAmount)",
  "event ReservesUpdated(uint256 indexed marketId, uint256 yes, uint256 no)",
  "event FeeCollected(uint256 indexed marketId, uint256 amount, address indexed to)",
]);

export const POSITION_BOUGHT_EVENT = BINARY_PREDICTION_MARKET_EVENTS[0];
export const POSITION_SOLD_EVENT = BINARY_PREDICTION_MARKET_EVENTS[1];
export const MARKET_RESOLVED_EVENT = BINARY_PREDICTION_MARKET_EVENTS[2];
export const REWARD_CLAIMED_EVENT = BINARY_PREDICTION_MARKET_EVENTS[3];
export const REFUND_CLAIMED_EVENT = BINARY_PREDICTION_MARKET_EVENTS[4];
export const TREASURY_REFUND_CLAIMED_EVENT = BINARY_PREDICTION_MARKET_EVENTS[5];
export const RESERVES_UPDATED_EVENT = BINARY_PREDICTION_MARKET_EVENTS[6];
export const FEE_COLLECTED_EVENT = BINARY_PREDICTION_MARKET_EVENTS[7];
