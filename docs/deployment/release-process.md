# Release Process Freeze (PR-12)

## Purpose

This document freezes the generic release process for XMarket Phase 1
deployments. It is intentionally EVM-generic and does not bind the project to a
specific testnet or mainnet.

This PR defines the process only. It does not perform a real broadcast.

## Release Stages

1. Prepare configuration
2. Run local validation
3. Rehearse against the selected profile
4. Broadcast only after approval
5. Verify artifacts and release record
6. Apply rollback procedure if any gate fails

## Preflight

Before any future `TESTNET` or `MAINNET` release:

- start from the reviewed commit on `main`
- copy `.env.example` into a local, untracked env file
- fill only the active profile values
- confirm `PRIVATE_KEY`, RPC URL, and any explorer fields are not committed
- confirm `BROADCAST=false` until all dry-runs succeed
- confirm role addresses (`RESOLVER`, `FEE_ROUTER`, `TREASURY`) are reviewed

## Standard Validation Commands

From repo root:

```bash
cd contracts
forge build
forge test --fuzz-runs 200 -vvv
forge script script/Deploy.s.sol:DeployScript -vvv
```

All three commands should pass before any broadcast is considered.

## Profile Execution

### `LOCAL`

Use for the default no-broadcast rehearsal:

```bash
cd contracts
forge script script/Deploy.s.sol:DeployScript -vvv
```

If local Anvil broadcast rehearsal is needed:

```bash
cd contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$LOCAL_RPC_URL" \
  --broadcast \
  -vvv
```

### `TESTNET`

Use only after a concrete network is approved in a later PR.

Suggested sequence:

```bash
cd contracts
forge build
forge test --fuzz-runs 200 -vvv
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$TESTNET_RPC_URL" \
  -vvv
```

Only after dry-run review and explicit approval:

```bash
cd contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$TESTNET_RPC_URL" \
  --broadcast \
  -vvv
```

### `MAINNET`

Use the same command shape as `TESTNET`, but with stricter operator controls:

- freeze the exact commit hash
- freeze the final env file locally
- review all role addresses a final time
- broadcast once from the approved signer
- record the output immediately after the run

```bash
cd contracts
forge script script/Deploy.s.sol:DeployScript \
  --rpc-url "$MAINNET_RPC_URL" \
  --broadcast \
  -vvv
```

## Optional Manual Preparation

Because the current script reads low-level fields directly, operators may need
to translate generic profile values before execution.

Examples:

- set `COLLATERAL="$COLLATERAL_ADDRESS"` when using external collateral
- derive `INITIAL_PRICE_YES_BPS` from `INITIAL_YES_AMOUNT` and `INITIAL_NO_AMOUNT`
- set explicit `START_TIME` and `END_TIME` from `MARKET_DURATION_SECONDS`

## Verification And Release Record

After any future broadcast:

- capture the deploy commit hash
- capture the active profile name
- capture the script output with deployed addresses
- record whether the run used mock or external collateral
- record whether explorer verification is still pending

In PR-12, `VERIFY`, `EXPLORER_API_KEY`, and `VERIFIER_URL` are reserved fields
only. No explorer verification is executed in this PR.

## Rollback Procedure

Phase 1 deployments are immutable, so there is no generic on-chain "undo"
operation after a broadcast. Rollback means operational rollback:

1. If the failure happens before broadcast, stop and fix the config locally.
2. If the failure happens after broadcast but before release sign-off, do not
   publish the new addresses as active.
3. Keep the previous approved deployment as the active release record.
4. Diagnose the issue, patch it in a new PR, and deploy a fresh contract set.
5. Record the abandoned attempt for auditability.

For `LOCAL` rehearsal, rollback is simpler:

- stop the local process
- reset Anvil if needed
- rerun with corrected config

## Known Phase 1 Limitation

`Deploy.s.sol` can create a fully wired standalone market for rehearsal, but the
factory-created market path still has the known `ammEngine` wiring limitation
documented in `docs/deployment/local-deployment.md`. PR-12 does not change that
behavior.
