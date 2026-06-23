import { execFileSync } from "node:child_process";
import process from "node:process";

import dotenv from "dotenv";
import puppeteer from "puppeteer";
import {
  createPublicClient,
  createWalletClient,
  erc20Abi,
  getAddress,
  http,
  parseAbi,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { bscTestnet } from "viem/chains";

dotenv.config({ path: ".env" });

const marketAbi = parseAbi([
  "function buyYes(uint256 collateralIn, uint256 minSharesOut)",
]);

const rpcUrl =
  process.env.E2E_RPC_URL ||
  process.env.NEXT_PUBLIC_BSC_TESTNET_RPC_URL ||
  "https://data-seed-prebsc-1-s1.bnbchain.org:8545";
const privateKey = process.env.E2E_PRIVATE_KEY || process.env.XMARKET_ADMIN_PRIVATE_KEY;
const appUrl = process.env.E2E_APP_URL || "http://127.0.0.1:3000";
const apiUrl = process.env.E2E_API_URL || "http://127.0.0.1:3001";
const indexerUrl = (process.env.E2E_INDEXER_URL || "http://127.0.0.1:4000").replace(/\/$/, "");
const marketAddress = getAddress(
  process.env.E2E_MARKET_ADDRESS || "0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07"
);
const collateralAddress = getAddress(
  process.env.E2E_COLLATERAL_ADDRESS || "0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB"
);
const approveAmount = BigInt(process.env.E2E_APPROVE_AMOUNT || "1000000");
const buyAmount = BigInt(process.env.E2E_BUY_AMOUNT || "1000000");

if (!privateKey) {
  throw new Error("Missing E2E_PRIVATE_KEY or XMARKET_ADMIN_PRIVATE_KEY");
}

const account = privateKeyToAccount(privateKey);
const transport = http(rpcUrl);
const publicClient = createPublicClient({
  account,
  chain: bscTestnet,
  transport,
});
const walletClient = createWalletClient({
  account,
  chain: bscTestnet,
  transport,
});

async function loginBySignature() {
  const nonceResponse = await fetch(`${apiUrl}/auth/nonce/${account.address}`);
  const noncePayload = await nonceResponse.json();
  const signature = await account.signMessage({ message: noncePayload.nonce });
  const verifyResponse = await fetch(`${apiUrl}/auth/verify`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      address: account.address,
      signature,
    }),
  });
  if (!verifyResponse.ok) {
    throw new Error(`Auth verify failed: ${verifyResponse.status}`);
  }
  const verifyPayload = await verifyResponse.json();
  console.log("Authenticated user:", verifyPayload.user.id);
}

async function approveAndBuy() {
  const approveHash = await walletClient.writeContract({
    address: collateralAddress,
    abi: erc20Abi,
    functionName: "approve",
    args: [marketAddress, approveAmount],
    chain: bscTestnet,
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: approveHash });
  console.log("Approved collateral:", approveHash);

  const buyHash = await walletClient.writeContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: "buyYes",
    args: [buyAmount, 0n],
    chain: bscTestnet,
    account,
  });
  await publicClient.waitForTransactionReceipt({ hash: buyHash });
  console.log("Bought YES shares:", buyHash);
}

function runIndexerSync() {
  execFileSync("npm", ["run", "sync", "--prefix", "indexer"], {
    cwd: process.cwd(),
    stdio: "inherit",
  });
}

async function pollIndexer() {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const [positionsResponse, tradesResponse] = await Promise.all([
      fetch(`${indexerUrl}/users/${account.address.toLowerCase()}/positions`),
      fetch(`${indexerUrl}/users/${account.address.toLowerCase()}/trades`),
    ]);
    const positions = await positionsResponse.json();
    const trades = await tradesResponse.json();
    const marketPosition = positions.find(
      (item) => item.marketAddress.toLowerCase() === marketAddress.toLowerCase()
    );
    const marketTrade = trades.find(
      (item) => item.marketAddress.toLowerCase() === marketAddress.toLowerCase()
    );
    if (marketPosition && marketTrade) {
      console.log("Indexer synced position/trade");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 3000));
    runIndexerSync();
  }
  throw new Error("Indexer did not sync the latest trade in time");
}

async function verifyPortfolioPage() {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`${appUrl}/portfolio?address=${account.address}`, {
      waitUntil: "networkidle0",
    });
    await page.waitForSelector("body");
    const content = await page.content();
    if (!content.includes("Indexed Portfolio Records")) {
      throw new Error("Portfolio page did not render indexed records section");
    }
    if (!content.toLowerCase().includes(account.address.slice(2, 8).toLowerCase())) {
      throw new Error("Portfolio page did not render the preview address");
    }
    console.log("Portfolio page rendered indexed preview");
  } finally {
    await browser.close();
  }
}

await loginBySignature();
await approveAndBuy();
runIndexerSync();
await pollIndexer();
await verifyPortfolioPage();

console.log("XMarket smoke e2e completed");
