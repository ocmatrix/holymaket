export interface IndexerHealth {
  status: string;
  chainId: string;
  database: string;
}

export interface IndexerMarket {
  id: string;
  chainId: string;
  marketId: string;
  marketAddress: string;
  factoryAddress: string;
  collateralToken?: string | null;
  question?: string | null;
  status: string;
  outcome: string;
  createdBlockNumber?: string | null;
  createdTxHash?: string | null;
  createdLogIndex?: number | null;
  resolvedBlockNumber?: string | null;
  resolvedTxHash?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface IndexerTrade {
  id: string;
  chainId: string;
  marketAddress: string;
  userAddress: string;
  side: string;
  action: string;
  collateralAmount: string;
  sharesAmount: string;
  feeAmount?: string | null;
  txHash: string;
  logIndex: number;
  blockNumber: string;
  blockTimestamp?: string | null;
  createdAt?: string;
}

export interface IndexerUserPosition {
  id: string;
  chainId: string;
  marketAddress: string;
  userAddress: string;
  yesShares: string;
  noShares: string;
  claimed: boolean;
  refunded: boolean;
  lastBlockNumber?: string | null;
  updatedAt: string;
  createdAt?: string;
}

export interface IndexerClaim {
  id: string;
  chainId: string;
  marketAddress: string;
  userAddress?: string | null;
  type: string;
  amount: string;
  txHash: string;
  logIndex: number;
  blockNumber: string;
  blockTimestamp?: string | null;
  createdAt?: string;
}
