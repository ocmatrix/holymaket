# XMarket Phase 1 架构蓝图文档

## 1. 项目定位

XMarket 是部署于 WANTOS Chain（Cosmos EVM）上的 Phase 1 受控生产版预测交易 / Smart Option 系统。

本阶段系统定位必须明确如下：

- 当前不是 Demo；
- 当前不是半成品 MVP；
- 当前是 Phase 1 Controlled Production Core；
- 当前仅冻结核心数学、市场生命周期、refundWindow 与 Treasury sweep 规则；
- 当前不包含前端、Indexer、测试网部署、真实 Oracle 运营体系。

## 2. Phase 1 系统边界

Phase 1 包含以下组件：

- MarketFactory
- BinaryPredictionMarket
- CPMMEngine
- Resolver / Oracle Resolver
- Treasury / FeeRouter
- Collateral Token
- Phase 1 Test Suite

Phase 1 不包含以下能力：

- 第三方转让市场
- Orderbook
- P2P 挂单
- 复杂 LP 系统
- 自动做市参数治理
- 多抵押资产
- 跨链结算
- Indexer
- 前端交易页面
- 测试网部署
- DAO 治理

## 3. 合约架构

### MarketFactory

MarketFactory 负责市场创建与参数绑定，并部署或登记 BinaryPredictionMarket。

需要强调：

- 当前 createMarket 的原子注资/资金注入路径仍存在后续修复空间，属于未冻结边界；
- 本文档不会将该问题描述为“已生产冻结”或“已最终闭环”。

### BinaryPredictionMarket

BinaryPredictionMarket 负责市场核心生命周期与资金结算，覆盖：

- YES / NO 仓位记录；
- buyYes / buyNo；
- sellYes / sellNo；
- resolution；
- claim；
- Cancelled / Invalid refund；
- refundWindow；
- Treasury sweep。

### CPMMEngine

CPMMEngine 是纯数学报价引擎，仅负责计算，不持有资金，覆盖：

- quoteBuyYes / quoteBuyNo；
- quoteSellYes / quoteSellNo；
- closed-form sell quote；
- input domain validation；
- candidate selection；
- rounding control；
- k invariant protection。

说明：

- CPMMEngine 不持有 collateral，不负责资金转移；
- 资金由 BinaryPredictionMarket 接收与转移，CPMMEngine 仅提供可验证的报价输出。

### Resolver / Oracle Resolver

Resolver / Oracle Resolver 负责写入市场结算状态（Resolved / Cancelled / Invalid）与证据字段。

说明：

- Phase 1 属于受控解析器（controlled resolver），并非完全去中心化的 Oracle 网络；
- 解析器运营与治理流程属于未冻结边界，需在后续阶段补齐。

### Treasury / FeeRouter

Treasury / FeeRouter 负责：

- 收取交易费用；
- 接收 refundWindow 结束后的剩余 collateral；
- 接收 rounding dust。

## 4. 市场生命周期

Phase 1 市场生命周期文本流程如下：

```text
Create Market
    ↓
Active
    ↓
Buy YES / Buy NO
    ↓
Sell YES / Sell NO
    ↓
Resolved / Cancelled / Invalid
    ↓
Claim or Refund
    ↓
Treasury Sweep
```

状态与操作约束：

- Create Market：只允许创建与参数初始化；是否完成原子注资闭环属于未冻结范围。
- Active：允许 buy/sell；不允许 claim/refund；不允许 Treasury sweep。
- Resolved：允许胜方 claim；不允许 refund；不允许 Treasury sweep。
- Cancelled / Invalid：允许用户在 refundWindow 内 refund；refundWindow 结束后允许 Treasury sweep。

## 5. 资金流架构

Phase 1 的资金流规则如下：

- buy 时：用户 collateral 进入 market；fee 进入 treasury / feeRouter；
- sell 时：用户将 YES / NO shares 卖回 AMM（由 market 内部账本体现），market 向用户支付 collateral；fee 进入 treasury / feeRouter；
- resolved 后：胜方 claim，market 向胜方支付对应 collateral；
- Cancelled / Invalid 后：按 `refund = floor((yesShares + noShares) / 2)` 执行 refund；
- refundWindow 结束后：未领取余额与 rounding dust 进入 Treasury。

## 6. 测试基准

当前冻结测试基准为：

```text
forge test --fuzz-runs 200 -vvv
40 tests | 40 passed | 0 failed
```

并且具体套件结果为：

- Phase1SpecTests：9/9 passed
- CPMMEngineSellDomainSpec：25/25 passed
- RefundWindowSpec：6/6 passed

## 7. 当前冻结范围

当前已冻结的内容如下：

- CPMMEngine sell quote 数学路径；
- quoteSellYes / quoteSellNo 输入域；
- 显式 revert 规则；
- 无 panic revert；
- k_after >= k_before；
- rounding error <= 5；
- Cancelled / Invalid refundWindow；
- Treasury sweep；
- 当前 40 条测试基准。

## 8. 当前未冻结范围

当前未冻结的内容如下：

- createMarket 原子注资；
- MarketFactory 生产级创建流程；
- 前端；
- Indexer；
- 测试网部署；
- 真实 Oracle 网络；
- 治理参数；
- 多资产 collateral；
- 安全审计报告；
- 主网上线流程。

