# PR-15 ABI Export Preparation

## Scope

PR-15 prepares ABI and SDK export inputs for external integration without changing contract behavior.

This PR does the following:

- exports core contract ABI JSON from Foundry build artifacts
- establishes `packages/abi/` as the ABI output directory
- establishes `docs/sdk/` as the SDK planning directory
- reserves future TypeScript generation paths in documentation only

This PR does not do the following:

- does not change contract business logic
- does not change ABI surface
- does not change events
- does not add frontend integration
- does not add indexer integration
- does not add network configuration
- does not install TypeChain, `ethers.js`, `viem`, or `abitype`

## ABI Source

All exported ABI files in `packages/abi/` come from the following Foundry artifacts:

- `contracts/out/BinaryPredictionMarket.sol/BinaryPredictionMarket.json`
- `contracts/out/MarketFactory.sol/MarketFactory.json`
- `contracts/out/CPMMEngine.sol/CPMMEngine.json`

The export rule is:

- read the Foundry artifact JSON
- extract the `abi` field
- write the extracted ABI array into `packages/abi/<ContractName>.json`

No ABI in this PR is handwritten.

## Output Layout

Current output layout:

- `packages/abi/BinaryPredictionMarket.json`
- `packages/abi/MarketFactory.json`
- `packages/abi/CPMMEngine.json`
- `packages/abi/README.md`
- `packages/sdk/README.md`

## Future TypeScript Generation Paths

PR-15 does not generate TypeScript types yet. The following paths are reserved for future work:

- `packages/sdk/src/generated/typechain/`
- `packages/sdk/src/generated/ethers/`
- `packages/sdk/src/generated/viem/`
- `packages/sdk/src/generated/abitype/`

Planned direction:

- TypeChain can consume `packages/abi/*.json` and emit bindings into `packages/sdk/src/generated/typechain/`
- an `ethers.js`-oriented adapter can live under `packages/sdk/src/generated/ethers/`
- `viem` helpers can live under `packages/sdk/src/generated/viem/`
- shared ABI-derived TypeScript types can live under `packages/sdk/src/generated/abitype/`

These paths are documentation-only reservations in PR-15 and are not created as active packages yet.

## Safety Boundary

The ABI export bundle is a packaging convenience layer only.

XMarket still owns:

- contract logic
- security policy
- permission boundaries
- event semantics
- integration sequencing

External SDK tooling must consume exported ABI data and must not drive contract design changes in this phase.
