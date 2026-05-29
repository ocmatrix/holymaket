# Critical Path Test Matrix (Phase 1)

| 模块 | 关键路径 | 当前覆盖状态 | 对应测试文件 | 覆盖类型 | 是否 Phase 1 必需 | 后续建议 |
|---|---|---|---|---|---|---|
| **MarketFactory** | 参数校验 (限额/费率/时间等) | 已覆盖 | `MarketFactoryParamSpec.t.sol` | unit, revert | 是 | 保持冻结 |
| **MarketFactory** | resolver / admin 权限 | 已覆盖 | `ResolverBoundarySpec.t.sol` | unit, revert | 是 | 保持冻结 |
| **MarketFactory** | collateral allowlist | 已覆盖 | `MarketFactoryParamSpec.t.sol` | unit, revert | 是 | 保持冻结 |
| **MarketFactory** | market 创建与流动性划转 | 已覆盖 | `MarketFactoryCreateMarketSpec.t.sol` | unit, integration | 是 | 保持冻结 |
| **MarketFactory** | fee 配置 | 已覆盖 | `MarketFactoryParamSpec.t.sol` | unit | 是 | 保持冻结 |
| **MarketFactory** | treasury 配置 | 已覆盖 | `FeeTreasuryAccountingSpec.t.sol` | unit, integration | 是 | 保持冻结 |
| **BinaryPredictionMarket** | lifecycle 状态机 | 已覆盖 | `MarketLifecycleStateMachineSpec.t.sol` | unit, integration | 是 | 保持冻结 |
| **BinaryPredictionMarket** | buy YES / NO | 已覆盖 | `Phase1SpecTests.t.sol` | unit, fuzz | 是 | 保持冻结 |
| **BinaryPredictionMarket** | sell YES / NO | 已覆盖 | `Phase1SpecTests.t.sol`, `CPMMSellExecutionDomainSpec` | unit, fuzz | 是 | 保持冻结 |
| **BinaryPredictionMarket** | claim | 已覆盖 | `ClaimPayoutSolvencySpec.t.sol` | unit, integration | 是 | 保持冻结 |
| **BinaryPredictionMarket** | refund | 已覆盖 | `RefundWindowSpec.t.sol` | unit, integration | 是 | 保持冻结 |
| **BinaryPredictionMarket** | resolve | 已覆盖 | `ResolverBoundarySpec.t.sol` | unit, revert | 是 | 保持冻结 |
| **BinaryPredictionMarket** | pause / unpause | 已覆盖 | `MarketLifecycleStateMachineSpec.t.sol` | unit | 是 | 保持冻结 |
| **BinaryPredictionMarket** | treasury refund / sweep | 已覆盖 | `RefundWindowSpec.t.sol` | unit, integration | 是 | 保持冻结 |
| **BinaryPredictionMarket** | event emission | 已覆盖 | `CoreEventEmissionSpec.t.sol` | event | 是 | 保持冻结 |
| **BinaryPredictionMarket** | revert path | 已覆盖 | 散布于多个 Spec | revert | 是 | 保持冻结 |
| **CPMMEngine** | buy pricing | 已覆盖 | `CPMMEngineBuyDomainSpec.t.sol` | unit, fuzz | 是 | 保持冻结 |
| **CPMMEngine** | sell pricing | 已覆盖 | `CPMMEngineSellDomainSpec.t.sol` | unit, fuzz | 是 | 保持冻结 |
| **CPMMEngine** | reserve update | 已覆盖 | `Phase1SpecTests.t.sol` | integration | 是 | 保持冻结 |
| **CPMMEngine** | fee calculation | 已覆盖 | `FeeTreasuryAccountingSpec.t.sol` | unit, integration | 是 | 保持冻结 |
| **CPMMEngine** | rounding behavior | 已覆盖 | `CPMMEngineSellDomainSpec.t.sol` | unit, fuzz | 是 | 保持冻结 |
| **CPMMEngine** | extreme input / fuzz case | 已覆盖 | `CPMMEngineBuyDomainSpec.t.sol` | fuzz | 是 | 保持冻结 |
| **CPMMEngine** | invariant coverage | 已覆盖 | `MarketCollateralSolvencyInvariantSpec.t.sol` | invariant | 是 | 保持冻结 |
| **Collateral / ERC20** | SafeERC20 usage | 间接覆盖 | 包含在所有集成/执行路径中 | integration | 是 | 后续可增加非标 ERC20 的专门 Mock 测试 |
| **Collateral / ERC20** | transferFrom path | 已覆盖 | `MarketFactoryCreateMarketSpec.t.sol` | integration, revert | 是 | 保持冻结 |
| **Collateral / ERC20** | fee collection path | 已覆盖 | `FeeTreasuryAccountingSpec.t.sol` | integration | 是 | 保持冻结 |
| **Collateral / ERC20** | reward / refund payout path | 已覆盖 | `ClaimPayoutSolvencySpec.t.sol` | integration | 是 | 保持冻结 |
| **Deployment / ABI** | DeployScript dry-run | 已覆盖 | 属于 PR-11 / PR-12 范围 | deployment | 是 | 参见之前 PR 的部署日志 |
| **Deployment / ABI** | ABI surface selector freeze | 已覆盖 | `Phase1InterfaceSurfaceSpec.t.sol` | interface | 是 | 保持冻结 |
| **Deployment / ABI** | interface compatibility | 已覆盖 | `Phase1InterfaceSurfaceSpec.t.sol` | interface | 是 | 保持冻结 |
| **Deployment / ABI** | event topic stability | 已覆盖 | `CoreEventEmissionSpec.t.sol` | event | 是 | 保持冻结 |
