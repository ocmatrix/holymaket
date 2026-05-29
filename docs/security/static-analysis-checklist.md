# Static Analysis Checklist (PR-13)

## Scope

This checklist freezes the minimum static-analysis review path for XMarket Phase 1
contracts without changing business logic, ABI surface, or deployment behavior.

Current target scope:

- `contracts/src/market/BinaryPredictionMarket.sol`
- `contracts/src/market/MarketFactory.sol`
- `contracts/src/pricing/CPMMEngine.sol`
- supporting contracts under `contracts/src/tokens/`, `contracts/src/fees/`,
  and `contracts/src/settlement/` when relevant to access control or token flow

This PR is documentation-first. It does not require Slither to be installed on
the local machine to be useful.

## Baseline Gate

Before any static-analysis review:

- [ ] `cd contracts && forge build`
- [ ] `cd contracts && forge test --fuzz-runs 200 -vvv`
- [ ] confirm no contract logic changes were introduced only to silence warnings

## Required Review Categories

### 1. Reentrancy

- [ ] confirm external state-changing market flows use `nonReentrant`
- [ ] review `buyYes`, `buyNo`, `sellYes`, `sellNo`, `claim`, and `refund`
- [ ] confirm effects and accounting updates remain consistent around token transfers
- [ ] document any function intentionally left outside `nonReentrant`

Current manual notes:

- `BinaryPredictionMarket` inherits `ReentrancyGuard`
- trading, claim, and refund paths already use `nonReentrant`
- no code changes are made in PR-13

### 2. Unchecked Call / Low-Level Call

- [ ] search for raw `.call`, `.delegatecall`, `.staticcall`, `send`, and raw `transfer`
- [ ] confirm token flow relies on `SafeERC20` rather than unchecked ERC20 returns
- [ ] document any raw low-level call if it is ever introduced later

Current manual notes:

- no raw low-level call usage was identified in `contracts/src`
- token movement in core contracts uses `SafeERC20`

### 3. Access Control

- [ ] review `DEFAULT_ADMIN_ROLE`, `ADMIN_ROLE`, `RESOLVER_ROLE`,
      `MARKET_CREATOR_ROLE`, and other admin roles
- [ ] confirm privileged setters and lifecycle transitions are role-gated
- [ ] confirm no unexpected public write path bypasses role checks
- [ ] confirm deployment and operational docs align with current role model

Current manual notes:

- `BinaryPredictionMarket`, `MarketFactory`, `FeeRouter`, `Treasury`,
  `MockUSDT`, and `AdminOracleResolver` all use `AccessControl`
- resolver/admin entry points are already covered by existing tests

### 4. Timestamp Dependency

- [ ] review all `block.timestamp` usage
- [ ] distinguish expected lifecycle time gating from risky pseudo-randomness
- [ ] confirm there is no randomness or price generation derived from timestamp
- [ ] record timestamp-dependent paths for deployment and ops review

Current manual notes:

- `BinaryPredictionMarket` uses `block.timestamp` for start/end gating,
  resolution timestamps, and refund window handling
- these are expected lifecycle dependencies, not entropy sources

### 5. Integer Rounding

- [ ] review integer division and `Math.ceilDiv` usage in `CPMMEngine`
- [ ] cross-check rounding-sensitive paths against existing invariants/tests
- [ ] document intentional rounding behavior instead of changing sell math

Current manual notes:

- `CPMMEngine` intentionally uses integer arithmetic and `ceilDiv`
- rounding behavior is already covered by dedicated buy/sell domain and
  solvency/invariant tests
- PR-13 must not change CPMM sell logic only to satisfy an analyzer

### 6. ERC20 Return Handling

- [ ] confirm production contracts use `SafeERC20`
- [ ] distinguish production code from test-only unchecked transfer warnings
- [ ] record any token integration assumptions in the review output

Current manual notes:

- production contracts use `SafeERC20`
- current Foundry lint warnings about unchecked transfers are in tests, not in
  the production contracts under `contracts/src`

### 7. Dead Code

- [ ] review contracts or functions that appear unused in the current Phase 1 flow
- [ ] distinguish intentionally retained admin/supporting modules from stale code
- [ ] avoid deleting code in PR-13 only to silence a static-analysis warning

Current manual notes:

- dead-code style findings should be triaged as review items, not auto-fixed in
  this PR

### 8. Unused Parameter Warnings

- [ ] review compiler/analyzer warnings for unused parameters
- [ ] document intentional placeholders or ABI-preserving constructor slots
- [ ] avoid refactoring signatures in PR-13 unless a real bug is proven

Current manual notes:

- any unused-parameter style findings should be documented and triaged
- PR-13 does not change ABI surface or constructor signature layout

## Optional Slither Pass

If Slither is available on the machine, run it after the baseline gate:

```bash
cd contracts
slither . --filter-paths "lib|test|script|broadcast|cache|out"
```

Optional detector-focused run:

```bash
cd contracts
slither . \
  --filter-paths "lib|test|script|broadcast|cache|out" \
  --detect reentrancy-eth,reentrancy-no-eth,reentrancy-benign,reentrancy-events,unchecked-lowlevel,unchecked-transfer,timestamp,dead-code,unused-return,unused-state
```

If Slither is not installed locally, keep this PR documentation-only and record
the recommended commands in `docs/security/slither-analysis.md`.

## Triage Rules

- Do not change business logic only to remove an informational warning
- Do not modify ABI, events, or deployment behavior in PR-13
- Separate "real issue", "expected pattern", and "future cleanup" findings
- Keep analyzer output attached to a commit hash when a real run is performed
