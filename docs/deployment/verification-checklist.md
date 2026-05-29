# Verification Checklist (PR-12)

## Purpose

This checklist freezes the minimum verification steps for future XMarket Phase 1
deployments across `LOCAL`, `TESTNET`, and `MAINNET` profiles.

PR-12 uses the checklist for process definition only. No real deployment is
performed here.

## Configuration Review

- [ ] `DEPLOY_PROFILE` is set to `LOCAL`, `TESTNET`, or `MAINNET`
- [ ] only the active profile RPC field is filled locally
- [ ] `PRIVATE_KEY` is present only in an untracked local env file when needed
- [ ] `TESTNET_RPC_URL` and `MAINNET_RPC_URL` remain empty in committed templates
- [ ] `EXPLORER_API_KEY` and `VERIFIER_URL` remain empty in committed templates
- [ ] `COLLATERAL_MODE` is explicitly chosen (`MOCK` or external collateral flow)
- [ ] `COLLATERAL_ADDRESS` is set only when external collateral is approved
- [ ] `RESOLVER`, `FEE_ROUTER`, and `TREASURY` are reviewed

## Build And Test Gates

- [ ] `cd contracts && forge build`
- [ ] `cd contracts && forge test --fuzz-runs 200 -vvv`
- [ ] `cd contracts && forge script script/Deploy.s.sol:DeployScript -vvv`
- [ ] no failing tests are present
- [ ] no skipped tests are introduced by the release work

## Runtime Parameter Review

- [ ] `QUESTION` matches the intended market prompt
- [ ] `INITIAL_COLLATERAL` or `INITIAL_LIQUIDITY` matches the release plan
- [ ] `INITIAL_PRICE_YES_BPS` is consistent with the intended yes/no split
- [ ] `START_TIME` and `END_TIME` are explicit for non-local releases
- [ ] fee and slippage parameters are unchanged unless intentionally reviewed
- [ ] `BROADCAST=false` for all rehearsal runs
- [ ] `VERIFY=false` unless a later PR enables explorer verification

## Broadcast Gate

- [ ] the commit hash is frozen and reviewed
- [ ] the active profile env file is reviewed by the operator
- [ ] the selected RPC URL matches the intended environment
- [ ] the deployer account matches the intended signer
- [ ] there is explicit approval before `--broadcast`

## Post-Broadcast Verification

- [ ] script output is saved with the deployed addresses
- [ ] deployed factory address is recorded
- [ ] deployed engine address is recorded
- [ ] deployed standalone market address is recorded when used
- [ ] collateral selection is recorded (`MockUSDT` or external token)
- [ ] role addresses are recorded alongside the release note
- [ ] explorer verification status is recorded, even if still pending

## Rollback Trigger Conditions

Trigger rollback procedure if any of the following happens:

- [ ] wrong profile or wrong RPC URL selected
- [ ] wrong signer or wrong role address detected
- [ ] dry-run and intended parameters do not match
- [ ] deployed addresses were produced but not approved for publication
- [ ] verification artifacts are incomplete

## Known Limitation Review

- [ ] the team acknowledges that factory-created markets still do not wire
      `ammEngine` automatically in the current Phase 1 baseline
- [ ] standalone market deployment is used only as the validated rehearsal path
