# PR-15 Open Source Module Record

## Recording Rule

PR-15 records future ABI and SDK tooling options for follow-up work. This document does not approve automatic installation.

Unless a later PR explicitly adds and validates a dependency, these modules remain documentation-only reservations.

## Module Matrix

| Module | Purpose | GitHub | License | Actually Introduced In PR-15 | Written To `package.json` In PR-15 | Written To Lockfile In PR-15 | Documentation Placeholder Only |
| --- | --- | --- | --- | --- | --- | --- | --- |
| TypeChain | Generate TypeScript contract bindings from exported ABI JSON | https://github.com/dethcrypto/TypeChain | MIT | No | No | No | Yes |
| ethers.js | Future runtime adapter target for contract calls and event subscriptions | https://github.com/ethers-io/ethers.js | MIT | No | No | No | Yes |
| viem | Future runtime adapter target for typed reads, writes, and event helpers | https://github.com/wevm/viem | MIT | No | No | No | Yes |
| abitype | Future ABI-derived TypeScript type generation for ABI-safe utility layers | https://github.com/wevm/abitype | MIT | No | No | No | Yes |

## Notes

- PR-15 does not install TypeChain.
- PR-15 does not install `ethers.js`.
- PR-15 does not install `viem`.
- PR-15 does not install `abitype`.
- PR-15 does not add a new npm workspace.
- PR-15 does not add `packages/abi/package.json`.
- PR-15 does not add `packages/sdk/package.json`.

## Planned Follow-Up Direction

- TypeChain remains a candidate for generated contract bindings.
- `ethers.js` remains a candidate runtime target if a later SDK layer needs it.
- `viem` remains a candidate runtime target if a later SDK layer prefers viem-native helpers.
- `abitype` remains a candidate for ABI-safe TypeScript type generation.

Any future adoption must be evaluated in the corresponding PR and recorded again with the exact version and lockfile impact.
