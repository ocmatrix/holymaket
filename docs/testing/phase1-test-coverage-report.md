# XMarket Phase 1 Test Coverage Report

## 1. 当前测试基线
- **PR**: PR-14
- **目标**: Phase 1 核心合约逻辑测试覆盖与关键路径冻结
- **Baseline Commit**: `main` 最新提交（PR-10, PR-11, PR-12, PR-13 等前置 PR 已合并）

## 2. 测试命令
```bash
forge test --fuzz-runs 200 -vvv
```

## 3. 测试总数
共执行了 200 个测试用例。

## 4. 测试状态
- **Passed**: 200
- **Failed**: 0
- **Skipped**: 0

## 5. `forge coverage` 执行结果
**执行失败**。

## 6. coverage 失败说明
执行 `forge coverage` 时，编译器报错 `Stack too deep. Try compiling with --via-ir (cli) ...`。
即使根据提示尝试使用 `forge coverage --ir-minimum` 开启 viaIR 与最低优化级别，仍然抛出 Yul 级别的栈深度异常：
`Error: Yul exception:Cannot swap Slot RET with Variable value4: too deep in the stack by 1 slots...`
该错误仅发生在 Foundry 为生成覆盖率报告而注入统计代码的特定编译模式下，**完全不影响正常的 `forge build` 构建和 `forge test` 测试运行**。

## 7. 已冻结测试范围
通过单元测试、Fuzz 测试以及 Invariant 模糊测试，当前已深度冻结以下模块的关键逻辑：
- **MarketFactory**:
  - `createMarket` 完整流程、初始流动性划转与记录。
  - 创建参数的严格校验（包括地址、限额、费率等）。
- **BinaryPredictionMarket**:
  - 核心状态机转换（Pending -> Active -> Resolved/Cancelled -> 结算）。
  - Buy/Sell/Claim/Refund 等核心交互方法的报价与执行结果一致性验证。
  - 费用（feeBps）收取路由、Treasury 记账。
- **CPMMEngine**:
  - `buy` / `sell` 报价函数数学闭环验证（单调性、非负性、对称性）。
  - 舍入误差一致性、极端流动性不 Panic 保证。
- **资金安全与一致性 (Solvency / Accounting)**:
  - `totalFeesCollected` 与 Treasury 余额匹配。
  - Refund Window 后的 Treasury Sweep 逻辑。
  - Claim 时的流动性守恒（绝不透支未赢股份资金）。
- **ABI 与接口**:
  - CoreEventEmissionSpec 全面覆盖事件触发逻辑。
  - 接口签名（ABI surface）兼容性冻结。

## 8. 未覆盖或弱覆盖范围
- **跨合约深度交互恶意攻击**：针对恶意的 ERC20 实现或回调钩子（如重入）的动态 Fuzz 测试覆盖相对单薄（目前依赖 CEI 规范与 Slither 静态分析）。
- **集成层**：与前端、SDK 及 Indexer 的端到端（E2E）集成测试尚未在此合约测试套件中包含。

## 9. 后续 PR 建议
- **针对 Coverage 失败**：可考虑在非核心逻辑处将局部变量打包进 struct（Stack Too Deep 重构），或等待 Foundry / Solc 进一步优化 coverage 插桩逻辑。由于要求不为 coverage 妥协业务代码，建议暂时跳过 coverage 报告生成，依赖严格的 PR review 和 Fuzz 测试。
- **针对测试盲区**：在 Phase 2 或独立的安全强化 PR 中，增加针对特定非标 ERC20（如 fee-on-transfer, 恶意重入 token）的 Mock 测试用例。

## 10. 不修改业务逻辑声明
本 PR 仅用于整理和输出当前测试的覆盖情况与基线文档。在整个执行过程中：
- 不修改 CPMMEngine 数学逻辑。
- 不修改 BinaryPredictionMarket 与 MarketFactory 业务逻辑。
- 不修改 refundWindow / treasury sweep 逻辑。
- 不修改 ABI surface 和事件定义。
- 不新增任何外部依赖、SDK、前端或 Indexer 代码。
