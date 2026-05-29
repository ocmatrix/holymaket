# PR-17 Frontend Minimum Integration

## 1. PR-17 目标
复用已有完整前端，不新建前端工程，不重写 UI。
在现有前端基础上接入 BSC Testnet 链上读写能力。

## 2. 已复用的现有前端结构
- `src/hooks/use-xmarket-chain-state.ts`
- `src/hooks/use-xmarket-write.ts`
- `src/components/market/c10-prediction-panel.tsx`
- `src/app/(dashboard)/profile/profile-content.tsx`
- `src/lib/contracts.ts`
- `src/lib/contract-abis.ts`

## 3. BSC Testnet 配置
- **Network**: BSC Testnet
- **Chain ID**: 97
- **RPC**: `https://data-seed-prebsc-1-s1.bnbchain.org:8545`

## 4. 合约地址
- **MarketFactory**: `0x45ab369f65c0ef44c1325323f283e6acc92b8bd0`
- **CPMMEngine**: `0x16fae185a854a54307f6dea9c0d53e326bb4f82f`
- **Standalone BinaryPredictionMarket**: `0x05caa8a264b2436f1851a58f4f183350fd330a2f`
- **MockUSDT**: `0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB`
- **Smoke-test market**: `0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07`

## 5. Chain Read Integration
前端已支持读取：
- `factory.ammEngine()`
- `factory.nextMarketId()`
- `MockUSDT name`
- `MockUSDT symbol`
- `MockUSDT decimals`
- `wallet mUSDT balance`
- `market.status()`
- `market.outcome()`

## 6. Minimum Write Integration
前端已接入：
- `approve mUSDT`
- `buyYes`
- `buyNo`
- `sellYes`
- `sellNo`
- `claim`

## 7. Guard / 状态管理
- **wallet guard**: 
  未连接钱包时显示 `Please connect wallet to transact.`
- **chain guard**: 
  非 BSC Testnet 时显示 `Please switch to BSC Testnet.`
- **transaction states**: 
  `loading` / `success` / `error`
- **resolved market guard**: 
  `smoke-test market` 当前已 Resolved。
  `buyYes` / `buyNo` / `sellYes` / `sellNo` 禁用。
  `claim` 保留。
  UI 显示：`This test market is resolved. Trading is disabled.`

## 8. PR-17 Stage 4 本地验收结果
- `node ./node_modules/next/dist/bin/next build`: PASS
- `Next dev local server`: PASS
- `local URL`: http://localhost:3005
- `white screen`: none
- `runtime error`: none
- `forge build --sizes`: PASS
- `forge test --fuzz-runs 200 -vvv`: 204 passed / 0 failed / 0 skipped
- `Blocker defects`: none
- `High defects`: none
- `Medium defects`: none
- `Low defects`: none

## 9. 安全与边界
- No contract code changes
- No ABI JSON changes
- No redeploy
- No Indexer
- No backend API
- No .env submitted
- No .trae submitted
- No node_modules submitted
- No .next submitted
- No private key / RPC secret submitted

## 10. 下一步
PR-17 completed.
Next stage: PR-18 Indexer Design.
