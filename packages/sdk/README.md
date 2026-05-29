# XMarket SDK Preparation

This directory is reserved for future SDK work.

PR-15 only prepares the ABI export and documentation boundary. It does not introduce an npm package, generated code, or runtime SDK implementation.

## Planned Inputs

- ABI source directory: `packages/abi/`
- planning documents: `docs/sdk/`

## Planned Future Output Paths

- `packages/sdk/src/generated/typechain/`
- `packages/sdk/src/generated/ethers/`
- `packages/sdk/src/generated/viem/`
- `packages/sdk/src/generated/abitype/`

## Current Phase Boundary

- no `package.json`
- no npm workspace changes
- no TypeScript type generation yet
- no frontend integration
- no indexer integration
