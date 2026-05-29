# PR-16 Stage 1-Rerun: Local Deployment + Market Lifecycle Verification

## 1. 验证目标
在修复 PR-16-FIX-1 后，重新在 `main` 上验证 `Deploy.s.sol` 的本地 Anvil 离线部署，以及验证 `MarketFactory` 创建市场与交易生命周期是否可以自动走通（无需手动 wiring）。

## 2. 环境信息
- **RPC URL**: `http://127.0.0.1:8545` (Local Anvil)
- **Chain ID**: `31337`
- **Deployer**: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- **Private Key Source**: Anvil default account 0

## 3. 合约地址
- **MarketFactory**: `0xcf7ed3acca5a467e9e704c703e8d87f634fb0fc9`
- **CPMMEngine**: `0x5fbdb2315678afecb367f032d93f642f64180aa3`
- **Standalone Market**: `0x0165878a594ca255338adfa4d48449f69242eb8f`
- **MockUSDT**: `0xe7f1725e7734ce288f8367e1bb143e90bb3f0512`

## 4. Factory-created Market Lifecycle Verification
通过集成测试脚本自动调用验证：
- **Factory Create Market**: PASS
- **Market Address**: `0xd8058efe0198ae9dD7D563e1b4938Dcbc86A1F81`
- **Market ID Assignment**: PASS (marketId = 0)
- **AMM Wiring Verification**: PASS
  - `market.ammEngine()` 正确返回 `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Liquidity Init**: PASS
- **Trading Verification**:
  - Buy YES: PASS (shares out: 19706)
  - Buy NO: PASS (shares out: 20095)
  - Sell YES: PASS
  - Sell NO: PASS
- **Resolution Verification**:
  - Resolve (YES): PASS
- **Claim Verification**:
  - Claim: PASS (user gained: 9853)

## 5. 问题复盘
1. **MarketFactory 24KB 超限**: 
   - 状态：已解决。
   - 说明：在 PR-16-FIX-1 中已将 `foundry.toml` 默认的 `optimizer_runs` 降为 200，目前 `MarketFactory` 的 size 约 19,141 bytes，存在 5,435 bytes 余量，部署顺利。
2. **Factory-created market ammEngine wiring limitation**: 
   - 状态：已解决。
   - 说明：Factory 成功预先配置了 `ammEngine` 并在 `createMarket` 中自动完成依赖注入。所有交易正常，无需人工干预。
3. **Factory-created market marketId 未设置**:
   - 状态：已解决。
   - 说明：Factory `createMarket` 自动分配递增的 `marketId`。

## 6. 结论
PR-16 Stage 1-Rerun 的本地集成部署和全生命周期验证均完美通过，符合进入 Stage 2 (BSC Testnet 部署) 的条件。
EOF; __tr_native_ec=$?; pwd -P >| '/var/folders/rg/2r1rs2t56jsftdgsyh7ntlbw0000gn/T/agent-toolhost/jobs/job-1e6927ef38cc44b7b2fd8c9e643dadc3/cwd.txt'; exit "$__tr_native_ec"