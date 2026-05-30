import assert from "node:assert/strict";
import test from "node:test";

import {
  applyRefundClaimToPosition,
  applyRewardClaimToPosition,
  applyTradeToPosition,
} from "./position-aggregation.js";

test("applyTradeToPosition increments shares on buy", () => {
  const result = applyTradeToPosition(
    {
      yesShares: "10",
      noShares: "5",
      claimed: false,
      refunded: false,
    },
    {
      side: "Yes",
      action: "Buy",
      sharesAmount: "7",
    }
  );

  assert.deepEqual(result, {
    yesShares: "17",
    noShares: "5",
    claimed: false,
    refunded: false,
  });
});

test("applyTradeToPosition decrements shares on sell", () => {
  const result = applyTradeToPosition(
    {
      yesShares: "10",
      noShares: "5",
      claimed: false,
      refunded: false,
    },
    {
      side: "No",
      action: "Sell",
      sharesAmount: "3",
    }
  );

  assert.deepEqual(result, {
    yesShares: "10",
    noShares: "2",
    claimed: false,
    refunded: false,
  });
});

test("applyTradeToPosition throws when a sell would make shares negative", () => {
  assert.throws(() =>
    applyTradeToPosition(
      {
        yesShares: "1",
        noShares: "0",
        claimed: false,
        refunded: false,
      },
      {
        side: "Yes",
        action: "Sell",
        sharesAmount: "2",
      }
    )
  );
});

test("applyRewardClaimToPosition marks claimed and clears the winning side", () => {
  const result = applyRewardClaimToPosition(
    {
      yesShares: "4",
      noShares: "9",
      claimed: false,
      refunded: false,
    },
    "Yes"
  );

  assert.deepEqual(result, {
    yesShares: "0",
    noShares: "9",
    claimed: true,
    refunded: false,
  });
});

test("applyRefundClaimToPosition marks refunded and clears both sides", () => {
  const result = applyRefundClaimToPosition({
    yesShares: "4",
    noShares: "9",
    claimed: false,
    refunded: false,
  });

  assert.deepEqual(result, {
    yesShares: "0",
    noShares: "0",
    claimed: false,
    refunded: true,
  });
});
