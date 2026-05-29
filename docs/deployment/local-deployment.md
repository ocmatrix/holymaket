# Local Deployment Preparation (PR-11)

## Scope

This document describes the minimal local deployment preparation path for Phase 1:

- Foundry script layout and execution
- Local-only deployment defaults that do not require real private keys
- Parameterization via environment variables

This is not a testnet deployment guide.

## Files

- `contracts/script/Deploy.s.sol`

## Defaults And Security

- Default mode is a dry-run without broadcasting transactions.
- No real private key or RPC URL is required for dry-run.
- No private key, RPC URL, or production address is hard-coded in the script.
- Environment variables are optional and have safe defaults.

## Dry-Run (No Broadcast)

From repo root:

```bash
cd contracts
forge script script/Deploy.s.sol:DeployScript -vvv
```

Expected behavior:

- Deploys a `CPMMEngine`
- Deploys a `MockUSDT` (if `COLLATERAL` is not provided)
- Deploys a `MarketFactory`
- Whitelists the selected collateral on the factory
- Optionally deploys one standalone `BinaryPredictionMarket` and fully wires `ammEngine` and liquidity (only when using `MockUSDT`)

## Local Broadcast (Anvil)

Start Anvil:

```bash
anvil
```

In another terminal, use one of the accounts shown by Anvil as the local broadcaster and set `BROADCAST=true`.

Example:

```bash
cd contracts
export BROADCAST=true
export PRIVATE_KEY="<anvil account private key>"
forge script script/Deploy.s.sol:DeployScript --rpc-url http://127.0.0.1:8545 --broadcast -vvv
```

Notes:

- `PRIVATE_KEY` is required only when `BROADCAST=true`.
- The private key should be sourced from local Anvil output only and must not be committed.

## Environment Variables

Addresses:

- `RESOLVER` (default: deployer)
- `FEE_ROUTER` (default: deployer)
- `TREASURY` (default: deployer)
- `COLLATERAL` (default: `0x0`, which triggers deploying `MockUSDT`)

Market params:

- `QUESTION` (default: `LOCAL: BTC>100k?`)
- `METADATA_URI` (default: `ipfs://local`)
- `START_TIME` (default: `block.timestamp`)
- `END_TIME` (default: `block.timestamp + 7 days`)
- `INITIAL_COLLATERAL` (default: `1_000_000`, 6 decimals if using `MockUSDT`)
- `INITIAL_PRICE_YES_BPS` (default: `5000`)
- `MIN_TRADE_AMOUNT` (default: `1`)
- `MAX_TRADE_AMOUNT` (default: `100_000`)
- `MAX_SLIPPAGE_BPS` (default: `500`)
- `FEE_BPS` (default: `50`)

Factory params:

- `SYSTEM_MAX_FEE_BPS` (default: `500`)
- `SYSTEM_MAX_SLIPPAGE_BPS` (default: `1000`)
- `TRADE_CAP_BPS` (default: `1000`)
- `MIN_INITIAL_COLLATERAL` (default: `1_000_000`)
- `MIN_INITIAL_PRICE_YES_BPS` (default: `3000`)
- `MAX_INITIAL_PRICE_YES_BPS` (default: `7000`)

Toggles:

- `DEPLOY_STANDALONE_MARKET` (default: `true`)
- `BROADCAST` (default: `false`)
- `PRIVATE_KEY` (default: `0`, required when `BROADCAST=true`)

## Known Limitation (Current Phase 1)

`MarketFactory.createMarket()` creates and initializes a market, but the resulting market does not have `ammEngine` wired by default.
This script deploys a standalone market to validate a fully wired local market path without changing core contracts.
