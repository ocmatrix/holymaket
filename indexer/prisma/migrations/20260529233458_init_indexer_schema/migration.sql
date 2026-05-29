-- CreateEnum
CREATE TYPE "MarketStatus" AS ENUM ('Created', 'Open', 'Closed', 'Resolved', 'Canceled');

-- CreateEnum
CREATE TYPE "MarketOutcome" AS ENUM ('Unresolved', 'Yes', 'No');

-- CreateEnum
CREATE TYPE "TradeSide" AS ENUM ('Yes', 'No');

-- CreateEnum
CREATE TYPE "TradeAction" AS ENUM ('Buy', 'Sell');

-- CreateEnum
CREATE TYPE "ClaimType" AS ENUM ('Reward', 'Refund', 'TreasuryRefund');

-- CreateTable
CREATE TABLE "Market" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "marketId" BIGINT NOT NULL,
    "marketAddress" TEXT NOT NULL,
    "factoryAddress" TEXT NOT NULL,
    "collateralToken" TEXT,
    "question" TEXT,
    "status" "MarketStatus" NOT NULL DEFAULT 'Created',
    "outcome" "MarketOutcome" NOT NULL DEFAULT 'Unresolved',
    "createdBlockNumber" BIGINT,
    "createdTxHash" TEXT,
    "createdLogIndex" INTEGER,
    "resolvedBlockNumber" BIGINT,
    "resolvedTxHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Market_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Trade" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "marketAddress" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "side" "TradeSide" NOT NULL,
    "action" "TradeAction" NOT NULL,
    "collateralAmount" TEXT NOT NULL,
    "sharesAmount" TEXT NOT NULL,
    "feeAmount" TEXT,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockTimestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Trade_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPosition" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "marketAddress" TEXT NOT NULL,
    "userAddress" TEXT NOT NULL,
    "yesShares" TEXT NOT NULL DEFAULT '0',
    "noShares" TEXT NOT NULL DEFAULT '0',
    "claimed" BOOLEAN NOT NULL DEFAULT false,
    "refunded" BOOLEAN NOT NULL DEFAULT false,
    "lastBlockNumber" BIGINT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserPosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Claim" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "marketAddress" TEXT NOT NULL,
    "userAddress" TEXT,
    "type" "ClaimType" NOT NULL,
    "amount" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockTimestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Claim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReserveSnapshot" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "marketAddress" TEXT NOT NULL,
    "yesReserve" TEXT NOT NULL,
    "noReserve" TEXT NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockTimestamp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReserveSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerState" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "scope" TEXT NOT NULL,
    "contractAddress" TEXT,
    "lastIndexedBlock" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndexerState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IndexerEventLog" (
    "id" TEXT NOT NULL,
    "chainId" INTEGER NOT NULL,
    "contractAddress" TEXT NOT NULL,
    "eventName" TEXT NOT NULL,
    "txHash" TEXT NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "blockHash" TEXT,
    "blockTimestamp" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndexerEventLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Market_chainId_status_idx" ON "Market"("chainId", "status");

-- CreateIndex
CREATE INDEX "Market_chainId_outcome_idx" ON "Market"("chainId", "outcome");

-- CreateIndex
CREATE UNIQUE INDEX "Market_chainId_marketAddress_key" ON "Market"("chainId", "marketAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Market_chainId_marketId_key" ON "Market"("chainId", "marketId");

-- CreateIndex
CREATE INDEX "Trade_chainId_marketAddress_idx" ON "Trade"("chainId", "marketAddress");

-- CreateIndex
CREATE INDEX "Trade_chainId_userAddress_idx" ON "Trade"("chainId", "userAddress");

-- CreateIndex
CREATE INDEX "Trade_chainId_blockNumber_idx" ON "Trade"("chainId", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Trade_chainId_txHash_logIndex_key" ON "Trade"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "UserPosition_chainId_userAddress_idx" ON "UserPosition"("chainId", "userAddress");

-- CreateIndex
CREATE INDEX "UserPosition_chainId_marketAddress_idx" ON "UserPosition"("chainId", "marketAddress");

-- CreateIndex
CREATE UNIQUE INDEX "UserPosition_chainId_marketAddress_userAddress_key" ON "UserPosition"("chainId", "marketAddress", "userAddress");

-- CreateIndex
CREATE INDEX "Claim_chainId_marketAddress_idx" ON "Claim"("chainId", "marketAddress");

-- CreateIndex
CREATE INDEX "Claim_chainId_userAddress_idx" ON "Claim"("chainId", "userAddress");

-- CreateIndex
CREATE INDEX "Claim_chainId_type_idx" ON "Claim"("chainId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "Claim_chainId_txHash_logIndex_key" ON "Claim"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "ReserveSnapshot_chainId_marketAddress_idx" ON "ReserveSnapshot"("chainId", "marketAddress");

-- CreateIndex
CREATE INDEX "ReserveSnapshot_chainId_blockNumber_idx" ON "ReserveSnapshot"("chainId", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ReserveSnapshot_chainId_txHash_logIndex_key" ON "ReserveSnapshot"("chainId", "txHash", "logIndex");

-- CreateIndex
CREATE INDEX "IndexerState_chainId_scope_idx" ON "IndexerState"("chainId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "IndexerState_chainId_scope_contractAddress_key" ON "IndexerState"("chainId", "scope", "contractAddress");

-- CreateIndex
CREATE INDEX "IndexerEventLog_chainId_contractAddress_idx" ON "IndexerEventLog"("chainId", "contractAddress");

-- CreateIndex
CREATE INDEX "IndexerEventLog_chainId_eventName_idx" ON "IndexerEventLog"("chainId", "eventName");

-- CreateIndex
CREATE INDEX "IndexerEventLog_chainId_blockNumber_idx" ON "IndexerEventLog"("chainId", "blockNumber");

-- CreateIndex
CREATE UNIQUE INDEX "IndexerEventLog_chainId_txHash_logIndex_key" ON "IndexerEventLog"("chainId", "txHash", "logIndex");

-- AddForeignKey
ALTER TABLE "Trade" ADD CONSTRAINT "Trade_chainId_marketAddress_fkey" FOREIGN KEY ("chainId", "marketAddress") REFERENCES "Market"("chainId", "marketAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPosition" ADD CONSTRAINT "UserPosition_chainId_marketAddress_fkey" FOREIGN KEY ("chainId", "marketAddress") REFERENCES "Market"("chainId", "marketAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Claim" ADD CONSTRAINT "Claim_chainId_marketAddress_fkey" FOREIGN KEY ("chainId", "marketAddress") REFERENCES "Market"("chainId", "marketAddress") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReserveSnapshot" ADD CONSTRAINT "ReserveSnapshot_chainId_marketAddress_fkey" FOREIGN KEY ("chainId", "marketAddress") REFERENCES "Market"("chainId", "marketAddress") ON DELETE RESTRICT ON UPDATE CASCADE;
