import assert from "node:assert/strict";
import test, { after, before } from "node:test";

import { PrismaClient } from "@prisma/client";

import {
  applyTradeToUserPosition,
  markUserPositionClaimed,
  markUserPositionRefunded,
} from "./position-aggregation.js";

// DB-backed reconciliation / event-replay tests for the position projection.
// Exercise the real Prisma upsert paths (not just the pure reducers) against a
// live Postgres. Skipped automatically where no test database is provisioned,
// so this never breaks pure-logic test runs or DB-less CI.
const skip = process.env.DATABASE_URL
  ? false
  : "requires DATABASE_URL (throwaway test Postgres)";

const CHAIN_ID = 987654;
const MARKET = "0x00000000000000000000000000000000000000a1";
const FACTORY = "0x00000000000000000000000000000000000000c3";
const USER = "0x00000000000000000000000000000000000000b2";

let prisma: PrismaClient;

before(async () => {
  if (skip) return;
  prisma = new PrismaClient();
  await prisma.userPosition.deleteMany({ where: { chainId: CHAIN_ID } });
  await prisma.market.deleteMany({ where: { chainId: CHAIN_ID } });
  await prisma.market.create({
    data: {
      chainId: CHAIN_ID,
      marketId: 1n,
      marketAddress: MARKET,
      factoryAddress: FACTORY,
    },
  });
});

after(async () => {
  if (prisma) {
    await prisma.userPosition.deleteMany({ where: { chainId: CHAIN_ID } });
    await prisma.market.deleteMany({ where: { chainId: CHAIN_ID } });
    await prisma.$disconnect();
  }
});

async function resetPosition(): Promise<void> {
  await prisma.userPosition.deleteMany({ where: { chainId: CHAIN_ID } });
}

async function readPosition() {
  return prisma.userPosition.findUnique({
    where: {
      chainId_marketAddress_userAddress: {
        chainId: CHAIN_ID,
        marketAddress: MARKET,
        userAddress: USER,
      },
    },
  });
}

async function trade(
  side: "Yes" | "No",
  action: "Buy" | "Sell",
  sharesAmount: string,
  blockNumber: bigint
): Promise<void> {
  await prisma.$transaction((tx) =>
    applyTradeToUserPosition(tx, {
      chainId: CHAIN_ID,
      marketAddress: MARKET,
      userAddress: USER,
      side,
      action,
      sharesAmount,
      blockNumber,
    })
  );
}

test("trade upserts accumulate persisted shares", { skip }, async () => {
  await resetPosition();
  await trade("Yes", "Buy", "10", 1n);
  await trade("Yes", "Buy", "5", 2n);
  const pos = await readPosition();
  assert.equal(pos?.yesShares, "15");
  assert.equal(pos?.noShares, "0");
  assert.equal(pos?.lastBlockNumber, 2n);
});

test("buy then equal sell round-trips to zero (persisted conservation)", { skip }, async () => {
  await resetPosition();
  await trade("Yes", "Buy", "1000", 1n);
  await trade("Yes", "Sell", "1000", 2n);
  const pos = await readPosition();
  assert.equal(pos?.yesShares, "0");
});

test("selling more than held is rejected and does not corrupt the persisted row", { skip }, async () => {
  await resetPosition();
  await trade("Yes", "Buy", "3", 1n);
  await assert.rejects(() => trade("Yes", "Sell", "4", 2n), /Negative bigint string result/);
  const pos = await readPosition();
  assert.equal(pos?.yesShares, "3"); // unchanged — reducer throws before the upsert
});

test("reward claim is idempotent across event replay (persisted)", { skip }, async () => {
  await resetPosition();
  await trade("Yes", "Buy", "10", 1n);
  await trade("No", "Buy", "4", 2n);
  const claim = () =>
    prisma.$transaction((tx) =>
      markUserPositionClaimed(tx, {
        chainId: CHAIN_ID,
        marketAddress: MARKET,
        userAddress: USER,
        outcome: "Yes",
        blockNumber: 3n,
      })
    );
  await claim();
  await claim(); // replay
  const pos = await readPosition();
  assert.equal(pos?.yesShares, "0");
  assert.equal(pos?.noShares, "4"); // loser side intact
  assert.equal(pos?.claimed, true);
});

test("refund is idempotent across event replay (persisted)", { skip }, async () => {
  await resetPosition();
  await trade("Yes", "Buy", "10", 1n);
  await trade("No", "Buy", "4", 2n);
  const refund = () =>
    prisma.$transaction((tx) =>
      markUserPositionRefunded(tx, {
        chainId: CHAIN_ID,
        marketAddress: MARKET,
        userAddress: USER,
        blockNumber: 3n,
      })
    );
  await refund();
  await refund(); // replay
  const pos = await readPosition();
  assert.equal(pos?.yesShares, "0");
  assert.equal(pos?.noShares, "0");
  assert.equal(pos?.refunded, true);
});
