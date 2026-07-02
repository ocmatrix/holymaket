import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRefundClaimToPosition,
  applyRewardClaimToPosition,
  applyTradeToPosition,
  type PositionSnapshot,
} from "./position-aggregation.js";

// Reconciliation / idempotency invariants for the position projection.
// These lock fund-safety and consistency guarantees that the on-chain -> off-chain
// ledger relies on. They exercise only the pure reducers (no Prisma runtime).

const emptyPosition: PositionSnapshot = {
  yesShares: "0",
  noShares: "0",
  claimed: false,
  refunded: false,
};

function position(overrides: Partial<PositionSnapshot> = {}): PositionSnapshot {
  return { ...emptyPosition, ...overrides };
}

// --- Fund safety: no phantom / negative shares ---

test("selling more shares than held is rejected (no negative balance)", () => {
  assert.throws(
    () =>
      applyTradeToPosition(position({ yesShares: "3" }), {
        side: "Yes",
        action: "Sell",
        sharesAmount: "4",
      }),
    /Negative bigint string result/
  );
});

test("selling exactly the held amount settles to zero", () => {
  const result = applyTradeToPosition(position({ noShares: "9" }), {
    side: "No",
    action: "Sell",
    sharesAmount: "9",
  });
  assert.equal(result.noShares, "0");
  assert.equal(result.yesShares, "0");
});

// --- Consistency: delta accounting only touches the traded side ---

test("a buy changes only the traded side by exactly the traded amount", () => {
  const before = position({ yesShares: "100", noShares: "40" });
  const after = applyTradeToPosition(before, {
    side: "Yes",
    action: "Buy",
    sharesAmount: "25",
  });
  assert.equal(after.yesShares, "125");
  assert.equal(after.noShares, before.noShares); // untouched
});

test("buy then equal sell round-trips back to the original position", () => {
  const before = position({ yesShares: "1000000000000000000", noShares: "7" });
  const bought = applyTradeToPosition(before, {
    side: "Yes",
    action: "Buy",
    sharesAmount: "333333333333333333",
  });
  const roundTripped = applyTradeToPosition(bought, {
    side: "Yes",
    action: "Sell",
    sharesAmount: "333333333333333333",
  });
  assert.deepEqual(roundTripped, before);
});

test("reducers are non-mutating (input snapshot is not modified)", () => {
  const before = position({ yesShares: "10", noShares: "5" });
  const snapshot = { ...before };
  applyTradeToPosition(before, { side: "Yes", action: "Buy", sharesAmount: "3" });
  assert.deepEqual(before, snapshot);
});

// --- Idempotency & terminal states for claim / refund (event-replay safety) ---

test("reward claim zeroes only the winning side and leaves the loser side intact", () => {
  const before = position({ yesShares: "12", noShares: "8" });
  const afterYesWin = applyRewardClaimToPosition(before, "Yes");
  assert.equal(afterYesWin.yesShares, "0");
  assert.equal(afterYesWin.noShares, "8"); // regression guard: loser side unchanged
  assert.equal(afterYesWin.claimed, true);
});

test("reward claim is idempotent under event replay", () => {
  const once = applyRewardClaimToPosition(position({ yesShares: "12", noShares: "8" }), "Yes");
  const twice = applyRewardClaimToPosition(once, "Yes");
  assert.deepEqual(twice, once);
});

test("refund zeroes both sides and marks refunded, idempotently", () => {
  const once = applyRefundClaimToPosition(position({ yesShares: "12", noShares: "8" }));
  assert.deepEqual(once, position({ yesShares: "0", noShares: "0", refunded: true }));
  const twice = applyRefundClaimToPosition(once);
  assert.deepEqual(twice, once);
});
