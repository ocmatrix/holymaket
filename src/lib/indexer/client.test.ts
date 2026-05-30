import assert from "node:assert/strict";
import test from "node:test";

import {
  IndexerRequestError,
  getIndexerHealth,
  getUserTrades,
} from "./client.ts";

const originalFetch = globalThis.fetch;
const originalBaseUrl = process.env.NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL;

test.afterEach(() => {
  globalThis.fetch = originalFetch;

  if (originalBaseUrl === undefined) {
    delete process.env.NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL;
  } else {
    process.env.NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL = originalBaseUrl;
  }
});

test("getIndexerHealth returns parsed health payload", async () => {
  process.env.NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL = "http://localhost:4000";

  globalThis.fetch = (async (input: string | URL | Request) => {
    assert.equal(String(input), "http://localhost:4000/health");

    return new Response(
      JSON.stringify({
        status: "ok",
        chainId: "97",
        database: "ok",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }) as typeof fetch;

  const health = await getIndexerHealth();

  assert.deepEqual(health, {
    status: "ok",
    chainId: "97",
    database: "ok",
  });
});

test("getUserTrades lowercases address parameters before requesting", async () => {
  process.env.NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL = "http://localhost:4000/";

  globalThis.fetch = (async (input: string | URL | Request) => {
    assert.equal(
      String(input),
      "http://localhost:4000/users/0x910956c25fd205a03d6314a3d787194c00022802/trades"
    );

    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }) as typeof fetch;

  const trades = await getUserTrades("0x910956C25fD205a03D6314A3d787194c00022802");

  assert.deepEqual(trades, []);
});

test("getUserTrades throws unavailable error when fetch fails", async () => {
  process.env.NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL = "http://localhost:4000";

  globalThis.fetch = (async () => {
    throw new Error("connect ECONNREFUSED 127.0.0.1:4000");
  }) as typeof fetch;

  await assert.rejects(
    () => getUserTrades("0x910956C25fD205a03D6314A3d787194c00022802"),
    (error: unknown) => {
      assert.ok(error instanceof IndexerRequestError);
      assert.equal(error.message, "Indexer data unavailable");
      assert.equal(error.isUnavailable, true);
      return true;
    }
  );
});
