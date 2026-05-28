# Phase 1 ABI Surface

## Scope

PR-10 freezes the Phase 1 integration-facing Solidity interface surface for:

- `MarketFactory`
- `BinaryPredictionMarket`
- `CPMMEngine`

This PR does not deploy contracts, wire a frontend, implement an SDK, or build an indexer.
This PR does not change business logic, AMM math, lifecycle rules, claim rules, refund rules, or fee/treasury accounting.

## Contract List

- `contracts/src/market/MarketFactory.sol`
- `contracts/src/market/BinaryPredictionMarket.sol`
- `contracts/src/pricing/CPMMEngine.sol`
- `contracts/src/tokens/MockUSDT.sol`

`MockUSDT` remains a local test token and is not part of the Phase 1 public integration ABI freeze.

## Interface Files

- `contracts/src/interfaces/IMarketFactory.sol`
- `contracts/src/interfaces/IBinaryPredictionMarket.sol`
- `contracts/src/interfaces/ICPMMEngine.sol`

No new `IResolver`, `IFeeRouter`, or `ITreasury` surface is introduced for PR-10 integration usage.
`FeeRouter` and `Treasury` exist in the codebase, but the current market/factory integration boundary only depends on their addresses.

## Contract ABI Surface

### MarketFactory

Stable read surface:

- `DEFAULT_ADMIN_ROLE()`
- `MARKET_CREATOR_ROLE()`
- `PAUSER_ROLE()`
- `nextMarketId()`
- `markets(uint256)`
- `getMarket(uint256)`
- `collateralAllowed(address)`
- `systemMaxFeeBps()`
- `systemMaxSlippageBps()`
- `tradeCapBps()`
- `minInitialCollateral()`
- `minInitialPriceYesBps()`
- `maxInitialPriceYesBps()`
- `resolver()`
- `feeRouter()`
- `treasury()`
- `hasRole(bytes32,address)`
- `getRoleAdmin(bytes32)`
- `supportsInterface(bytes4)`

Stable write surface:

- `createMarket(CreateMarketParams)`
- `setCollateralAllowed(address,bool)`
- `setResolver(address)`
- `setFeeRouter(address)`
- `setTreasury(address)`
- `grantRole(bytes32,address)`
- `revokeRole(bytes32,address)`
- `renounceRole(bytes32,address)`

Stable event surface:

- `MarketCreated`

Stable custom error surface:

- `InsufficientLiquidity`
- `InvalidPriceBps`
- `CollateralNotWhitelisted`
- `InvalidFeeBps`
- `TradeLimitExceeded`
- `ZeroInitialCollateral`
- `ZeroCollateralAddress`

Stable params surface:

- `CreateMarketParams`
  - `question`
  - `metadataURI`
  - `collateral`
  - `startTime`
  - `endTime`
  - `initialCollateral`
  - `initialPriceYesBps`
  - `minTradeAmount`
  - `maxTradeAmount`
  - `maxSlippageBps`
  - `feeBps`

### BinaryPredictionMarket

Stable read surface:

- `DEFAULT_ADMIN_ROLE()`
- `RESOLVER_ROLE()`
- `ADMIN_ROLE()`
- `marketId()`
- `question()`
- `metadataURI()`
- `collateral()`
- `startTime()`
- `endTime()`
- `feeBps()`
- `maxSlippageBps()`
- `minTradeAmount()`
- `maxTradeAmount()`
- `outcome()`
- `status()`
- `evidenceURI()`
- `resolvedAt()`
- `refundWindow()`
- `collateralLocked()`
- `pairSupply()`
- `totalYesSupply()`
- `totalNoSupply()`
- `R_yes()`
- `R_no()`
- `totalUserYesShares()`
- `totalUserNoShares()`
- `totalFeesCollected()`
- `yesShares(address)`
- `noShares(address)`
- `claimedFinalPayout(address)`
- `treasuryYes()`
- `treasuryNo()`
- `resolver()`
- `feeRouter()`
- `treasury()`
- `ammEngine()`
- `paused()`
- `getPrices()`
- `getUserPosition(address)`
- `quoteBuyYes(uint256)`
- `quoteBuyNo(uint256)`
- `quoteSellYes(uint256)`
- `quoteSellNo(uint256)`
- `hasRole(bytes32,address)`
- `getRoleAdmin(bytes32)`
- `supportsInterface(bytes4)`

Stable write surface:

- `buyYes(uint256,uint256)`
- `buyNo(uint256,uint256)`
- `sellYes(uint256,uint256)`
- `sellNo(uint256,uint256)`
- `resolveByAdmin(Outcome,string)`
- `cancel(string,string)`
- `markInvalid(string,string)`
- `claim()`
- `refund()`
- `refundTreasury()`
- `pause()`
- `unpause()`
- `grantRole(bytes32,address)`
- `revokeRole(bytes32,address)`
- `renounceRole(bytes32,address)`

Operational setup surface currently present in ABI:

- `initializeLiquidity(uint256,uint16)`
- `setAmmEngine(address)`
- `setMarketId(uint256)`

Stable enum surface:

- `Outcome`
  - `Unset`
  - `Yes`
  - `No`
  - `Cancelled`
  - `Invalid`
- `MarketStatus`
  - `Active`
  - `Paused`
  - `Resolved`
  - `Cancelled`
  - `Invalid`

Stable event surface:

- `LiquidityInitialized`
- `PositionBought`
- `PositionSold`
- `MarketResolved`
- `RewardClaimed`
- `RefundClaimed`
- `TreasuryRefundClaimed`
- `FeeCollected`
- `MarketPaused`
- `MarketUnpaused`
- `ReservesUpdated`

Custom error surface:

- No contract-defined custom errors are declared in `BinaryPredictionMarket`.
- Current revert surface is string-based for market-specific checks, plus inherited OpenZeppelin errors where applicable.

### CPMMEngine

Stable read/quote surface:

- `getSpotPrice(uint256,uint256)`
- `quoteBuyYes(uint256,uint256,uint256,uint16)`
- `quoteBuyNo(uint256,uint256,uint256,uint16)`
- `quoteSellYes(uint256,uint256,uint256,uint16)`
- `quoteSellNo(uint256,uint256,uint256,uint16)`

Internal helpers such as `_selectSellYesQuote`, `_selectSellNoQuote`, `_quoteSellYesCandidate`, `_quoteSellNoCandidate`, `_pickBetterSellCandidate`, and `_computePriceImpact` are not part of the ABI surface.

Custom error surface:

- No contract-defined custom errors are declared in `CPMMEngine`.
- Current revert surface is string-based for invalid domains such as zero input, empty pool, reserve exhaustion, and insufficient depth.

## Read Methods

Frontend, scripts, and indexers may safely depend on:

- Factory registry reads: `nextMarketId`, `markets`, `getMarket`
- Factory configuration reads: collateral allowlist and system parameter getters
- Market metadata reads: `question`, `metadataURI`, `startTime`, `endTime`, `resolver`, `treasury`, `feeBps`
- Market state reads: `status`, `outcome`, `resolvedAt`, `refundWindow`
- Market accounting reads: `collateralLocked`, `pairSupply`, `totalYesSupply`, `totalNoSupply`, `totalFeesCollected`
- Reserve reads: `R_yes`, `R_no`, `getPrices`
- User position reads: `yesShares`, `noShares`, `claimedFinalPayout`, `getUserPosition`
- Quote reads: `quoteBuyYes`, `quoteBuyNo`, `quoteSellYes`, `quoteSellNo`

## Write Methods

User trading:

- `buyYes`
- `buyNo`
- `sellYes`
- `sellNo`

User settlement:

- `claim`
- `refund`

Factory/admin/resolver operations:

- `createMarket`
- `setCollateralAllowed`
- `setResolver`
- `setFeeRouter`
- `setTreasury`
- `resolveByAdmin`
- `cancel`
- `markInvalid`
- `refundTreasury`
- `pause`
- `unpause`

## Quote Flow

Recommended buy flow:

1. Read `status`, `startTime`, `endTime`, `feeBps`, `minTradeAmount`, and `maxTradeAmount`.
2. Call `quoteBuyYes` or `quoteBuyNo`.
3. Submit `buyYes` or `buyNo` with `minSharesOut` set from caller slippage policy.

Recommended sell flow:

1. Read user share balances with `yesShares` or `noShares`.
2. Call `quoteSellYes` or `quoteSellNo`.
3. Submit `sellYes` or `sellNo` with `minCollateralOut` set from caller slippage policy.

Low-level quoting against `CPMMEngine` is allowed for simulations, testing, and off-chain preview logic.

## Slippage Parameters

- Factory creation bounds `CreateMarketParams.maxSlippageBps`.
- Per-trade execution guards are:
  - `buyYes(uint256 collateralIn, uint256 minSharesOut)`
  - `buyNo(uint256 collateralIn, uint256 minSharesOut)`
  - `sellYes(uint256 sharesIn, uint256 minCollateralOut)`
  - `sellNo(uint256 sharesIn, uint256 minCollateralOut)`
- Quote methods return `priceImpactBps` for off-chain guardrail logic.

## Claim And Refund Flow

Resolved market payout flow:

1. Resolver calls `resolveByAdmin(Outcome.Yes|Outcome.No, evidenceURI)`.
2. Users read `outcome`, `status`, and winning balances.
3. Users call `claim()`.

Cancelled or invalid market refund flow:

1. Resolver calls `cancel` or `markInvalid`.
2. Users read `resolvedAt` and `refundWindow`.
3. Users call `refund()` before `resolvedAt + refundWindow`.
4. Treasury calls `refundTreasury()` after the refund window closes.

## Resolver And Admin Operations

Resolver-facing methods:

- `resolveByAdmin`
- `cancel`
- `markInvalid`

Admin-facing methods currently present in ABI:

- Factory config setters
- Role management inherited from `AccessControl`
- Market safety switch: `pause`, `unpause`
- Market setup helpers: `initializeLiquidity`, `setAmmEngine`, `setMarketId`

## Event Subscription List

Indexer/off-chain listeners may subscribe to:

- `MarketFactory.MarketCreated`
- `BinaryPredictionMarket.LiquidityInitialized`
- `BinaryPredictionMarket.ReservesUpdated`
- `BinaryPredictionMarket.PositionBought`
- `BinaryPredictionMarket.PositionSold`
- `BinaryPredictionMarket.FeeCollected`
- `BinaryPredictionMarket.MarketResolved`
- `BinaryPredictionMarket.RewardClaimed`
- `BinaryPredictionMarket.RefundClaimed`
- `BinaryPredictionMarket.TreasuryRefundClaimed`
- `BinaryPredictionMarket.MarketPaused`
- `BinaryPredictionMarket.MarketUnpaused`

## Errors And Reverts

Factory custom errors are part of the frozen ABI surface.

Market and engine revert behavior is currently expressed through:

- String reverts for domain and state checks
- Inherited OpenZeppelin errors for access control, pausing, and ERC20 transfer failures

PR-10 does not convert string reverts to custom errors.

## Internal Details Not Safe To Depend On

The following details are present in the current implementation but should not be treated as frontend or SDK integration contracts:

- Direct assumptions about reserve update internals beyond documented quote and event outputs
- Deployment/factory wiring helpers: `initializeLiquidity`, `setAmmEngine`, `setMarketId`
- Storage layout, internal helper functions, and event emission implementation order
- Any internal CPMM helper not exposed through `ICPMMEngine`
- Test-only token behavior from `MockUSDT`

## ABI Stability Commitment

Phase 1 public interfaces are frozen at the Solidity ABI layer for:

- Factory market creation and registry lookup
- Market read/write/quote/settlement methods
- Core event subscription surface
- CPMM quote surface

PR-10 does not guarantee a packaged SDK, ABI export bundle, or frontend adapter yet.

## Follow-Up PR Relationship

- PR-10 freezes Solidity-facing interface and ABI expectations only.
- PR-11 remains out of scope for this PR.
- PR-15 will prepare ABI and SDK export packaging.
- PR-17 will build the minimal frontend integration.
- PR-18 and PR-19 will design and implement the indexer path.
