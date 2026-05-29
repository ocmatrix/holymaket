# XMarket Phase 1 ABI Exports

This directory stores the exported Phase 1 contract ABIs for external integration work.

## Source Of Truth

- Source build system: Foundry
- Source artifact directory: `contracts/out/`
- Export rule: extract the `abi` field from Foundry build artifacts
- Handwritten ABI: forbidden

## Exported Contracts

- `BinaryPredictionMarket.json`
- `MarketFactory.json`
- `CPMMEngine.json`

## Exact Artifact Sources

- `contracts/out/BinaryPredictionMarket.sol/BinaryPredictionMarket.json`
- `contracts/out/MarketFactory.sol/MarketFactory.json`
- `contracts/out/CPMMEngine.sol/CPMMEngine.json`

## Intended Consumers

- Future TypeChain code generation
- Future `ethers.js` adapter work
- Future `viem` and `abitype` integration
- External tooling that needs stable Solidity ABI JSON

## Update Process

1. Run `cd contracts && ~/.foundry/bin/forge build`
2. Re-export the ABI JSON files from the Foundry artifacts
3. Do not edit the exported ABI JSON by hand
