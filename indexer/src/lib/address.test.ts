import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAddress } from "./address.js";

test("normalizeAddress lowercases a valid checksum address", () => {
  assert.equal(
    normalizeAddress("0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07"),
    "0x87445f25f78e3eee91090c80bdeb2f1ae1296a07"
  );
});

test("normalizeAddress throws for an invalid address", () => {
  assert.throws(() => normalizeAddress("not-an-address"));
});
