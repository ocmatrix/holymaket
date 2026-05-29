# Deployment Configuration Freeze (PR-12)

## Scope

This document freezes the generic deployment configuration model for XMarket
Phase 1 without binding the process to any specific EVM network.

Profiles:

- `LOCAL`
- `TESTNET`
- `MAINNET`

This PR does not perform a real deployment, does not commit real secrets, and
does not lock the project to a concrete testnet or mainnet.

## Configuration Layers

There are two configuration layers in Phase 1:

1. Operator-facing profile variables in the repo root `.env.example`
2. Low-level Foundry script variables currently consumed by `contracts/script/Deploy.s.sol`

The profile variables make the release process consistent across future EVM
targets. The low-level variables keep the existing Foundry script reusable
without changing its deployment behavior.

## Profile Semantics

### `LOCAL`

Use for dry-runs and Anvil-only rehearsal.

- `LOCAL_RPC_URL` defaults to `http://127.0.0.1:8545`
- `PRIVATE_KEY` can stay empty for dry-run
- `BROADCAST` should remain `false` unless explicitly testing against local Anvil
- `COLLATERAL_MODE=MOCK` keeps the current `MockUSDT` path

### `TESTNET`

Use for future public testnet rehearsal after a concrete network is approved.

- `TESTNET_RPC_URL` stays empty in committed templates
- `PRIVATE_KEY` must be supplied only in an untracked local env file
- `VERIFY`, `EXPLORER_API_KEY`, and `VERIFIER_URL` are reserved for later use
- `CHAIN_NAME` and `CHAIN_ID` are placeholders for future WANTOS Testnet or
  other approved EVM testnets

### `MAINNET`

Use only for future production releases after the release process is approved.

- `MAINNET_RPC_URL` stays empty in committed templates
- explicit role addresses should be reviewed before broadcast
- `CHAIN_NAME` and `CHAIN_ID` are placeholders for future WANTOS Mainnet or
  other approved EVM mainnets

## Field Mapping

The current deployment script reads the low-level fields below. The profile
variables freeze the operator workflow, while the mapped script variables keep
`Deploy.s.sol` unchanged.

| Generic field | Current script field | Notes |
| --- | --- | --- |
| `COLLATERAL_MODE=MOCK` | `COLLATERAL` unset or zero | Triggers local `MockUSDT` deployment |
| `COLLATERAL_MODE=EXTERNAL` | `COLLATERAL=<token address>` | Use only with an approved ERC20 collateral |
| `COLLATERAL_ADDRESS` | `COLLATERAL` | Copy the address when using external collateral |
| `MARKET_QUESTION` | `QUESTION` | Keep the same human-readable question text |
| `MARKET_DURATION_SECONDS` | `START_TIME` + `END_TIME` | Convert to explicit timestamps before running the script |
| `INITIAL_LIQUIDITY` | `INITIAL_COLLATERAL` | Current script initializes total collateral directly |
| `INITIAL_YES_AMOUNT` + `INITIAL_NO_AMOUNT` | `INITIAL_PRICE_YES_BPS` | Use these values to derive the starting price off-chain |
| `DEPLOY_STANDALONE_MARKET` | `DEPLOY_STANDALONE_MARKET` | Direct passthrough |
| `DEPLOY_MARKET_FACTORY` | always deploys in current script | Reserved for future process control; current script still deploys the factory |
| `VERIFY` | not consumed in current script | Reserved for future explorer verification steps |

For the current script, derive:

- `INITIAL_PRICE_YES_BPS = INITIAL_YES_AMOUNT * 10000 / (INITIAL_YES_AMOUNT + INITIAL_NO_AMOUNT)`
- `START_TIME` and `END_TIME` from the intended release window

## Current Script Parameters

`contracts/script/Deploy.s.sol` currently accepts the following low-level
inputs:

- addresses: `RESOLVER`, `FEE_ROUTER`, `TREASURY`, `COLLATERAL`
- market params: `QUESTION`, `METADATA_URI`, `START_TIME`, `END_TIME`,
  `INITIAL_COLLATERAL`, `INITIAL_PRICE_YES_BPS`, `MIN_TRADE_AMOUNT`,
  `MAX_TRADE_AMOUNT`, `MAX_SLIPPAGE_BPS`, `FEE_BPS`
- factory params: `SYSTEM_MAX_FEE_BPS`, `SYSTEM_MAX_SLIPPAGE_BPS`,
  `TRADE_CAP_BPS`, `MIN_INITIAL_COLLATERAL`, `MIN_INITIAL_PRICE_YES_BPS`,
  `MAX_INITIAL_PRICE_YES_BPS`
- toggles: `DEPLOY_STANDALONE_MARKET`, `BROADCAST`, `PRIVATE_KEY`

## Reserved Fields For Future Network Binding

The following fields are intentionally present but unset in committed config:

- `TESTNET_RPC_URL`
- `MAINNET_RPC_URL`
- `EXPLORER_API_KEY`
- `VERIFIER_URL`
- `CHAIN_NAME`
- `CHAIN_ID`

They are reserved so future WANTOS Testnet / WANTOS Mainnet work can reuse the
same release checklist without changing the generic config shape.

## Security Rules

- Do not commit real `.env` files
- Do not commit real private keys
- Do not commit real RPC URLs for approved testnet or mainnet environments
- Do not hard-code production addresses
- Keep profile templates generic until a future PR explicitly binds a concrete
  network
