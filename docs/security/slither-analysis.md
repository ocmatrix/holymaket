# Slither Analysis Notes (PR-13)

## Status In This PR

PR-13 does not require a live Slither run to be useful.

Local machine status during Stage 1:

- `slither`: not installed
- `python3 -m pip show slither-analyzer`: package not found

Because Slither is not already available on this machine, this PR keeps the
repository dependency-free and records the static-analysis workflow as
documentation only.

## Tool Reference

- Official Git repository: `https://github.com/crytic/slither`
- PyPI package: `slither-analyzer`
- Observed PyPI version during Stage 1 research: `0.11.5`
- Installation methods documented upstream:
  - `uv tool install slither-analyzer`
  - `uvx --from slither-analyzer slither <target>`
  - `python3 -m pip install slither-analyzer`
  - `brew install slither-analyzer`
- License: `GNU Affero General Public License v3 (AGPL-3.0)`

## Repository Dependency Policy

- Is Slither written into repository dependencies: no
- Is a lockfile or package manifest updated in this PR: no
- Is a global install forced in this PR: no

PR-13 is intentionally limited to process documentation so that the team can run
Slither later on a prepared machine or CI environment without expanding the
current repo dependency surface.

## Recommended Usage Scope

When Slither is available, run it against the Foundry contracts workspace for
review and triage:

```bash
cd contracts
slither . --filter-paths "lib|test|script|broadcast|cache|out"
```

Recommended focus for the first pass:

- reentrancy detectors
- unchecked low-level call detectors
- unchecked transfer / ERC20 return handling detectors
- access-control review via summary printers and manual triage
- timestamp usage detector
- dead-code and unused-state warnings

Optional focused command:

```bash
cd contracts
slither . \
  --filter-paths "lib|test|script|broadcast|cache|out" \
  --detect reentrancy-eth,reentrancy-no-eth,reentrancy-benign,reentrancy-events,unchecked-lowlevel,unchecked-transfer,timestamp,dead-code,unused-return,unused-state
```

Optional human-readable checklist output:

```bash
cd contracts
slither . \
  --filter-paths "lib|test|script|broadcast|cache|out" \
  --checklist
```

## Manual Review Notes From Current Baseline

These notes were produced without a live Slither run and should be treated as
manual pre-triage, not as a substitute for analyzer output.

### Reentrancy

- `BinaryPredictionMarket` inherits `ReentrancyGuard`
- state-changing user flows such as `buyYes`, `buyNo`, `sellYes`, `sellNo`,
  `claim`, and `refund` are marked `nonReentrant`

### ERC20 Return Handling

- production contracts use `SafeERC20`
- current Foundry lint warnings about unchecked ERC20 transfers appear in tests,
  not in the production contracts

### Access Control

- `AccessControl` protects market admin/resolver paths and factory admin paths
- role review remains a required manual step even when Slither is added later

### Timestamp Dependency

- `block.timestamp` is used for lifecycle gating and refund window logic in
  `BinaryPredictionMarket`
- this is expected business logic dependence, but should still be documented in
  audit prep

### Integer Rounding

- `CPMMEngine` uses integer arithmetic and `Math.ceilDiv`
- rounding-sensitive behavior is intentionally tested and must not be refactored
  in PR-13 only to reduce analyzer noise

### Dead Code / Unused Warnings

- these findings should be triaged carefully because some admin/supporting
  contracts may be intentionally retained for later integration work
- PR-13 should document such findings rather than force unrelated cleanup

## Suggested Follow-Up

If a later PR or CI environment enables Slither:

1. pin the exact Slither version used for reproducibility
2. store the raw output artifact alongside the reviewed commit hash
3. triage findings into:
   - confirmed issue
   - accepted/expected pattern
   - future cleanup
4. keep logic changes, if any, in a separate bugfix PR rather than mixing them
   into tooling-only work
