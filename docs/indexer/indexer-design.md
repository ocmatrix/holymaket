# XMarket Phase 1 Indexer Design

## 1. Indexer 作用边界

Indexer 是一个链下数据索引层，负责监听链上合约事件并将其转换为结构化查询数据。

### 1.1 Indexer NOT 合约事实来源

Indexer **不是**合约状态的唯一真实来源。

智能合约仍然是以下数据的最终事实来源：

- 市场当前状态（Active / Paused / Resolved / Cancelled / Invalid）
- 链上储备金（`R_yes` / `R_no`）
- 用户当前链上持仓（`yesShares` / `noShares` 映射）
- 用户可 claim 金额（通过合约 `_calculatePayout` 实时计算）
- 最终结算结果（`outcome`）

### 1.2 Indexer 负责

- 市场列表和元数据缓存
- 市场历史（创建 → 流动性初始化 → 交易 → 结算）
- 交易历史查询
- 用户操作历史
- 用户仓位快照（非实时，通过事件累计推导）
- 结算记录
- claim / refund 记录（含交易哈希、区块高度、时间戳）
- 前端查询性能优化

### 1.3 前端使用约定

- **关键交易前以链上实时读取为准**（如 claim 金额、当前持仓）
- Indexer 仅用于展示、列表、历史、搜索、缓存
- 前端可同时展示 Indexer 数据和链上实时数据，标注数据来源

### 1.4 Phase 1 不做

- 不做生产级高可用部署
- 不做 WebSocket 实时推送
- 不做多链索引
- 不做复杂的分析报表引擎
- 不做重排（reorg）安全策略（Phase 1 可接受 BSC Testnet 低重排风险）
- 不做 GraphQL API（除非选 Ponder 自带）

---

## 2. 事件索引计划

### 2.1 合约事件总览

Indexer 需要监听以下合约的事件：

| 优先级 | 事件名 | 所属合约 | 触发场景 | 是否 Phase 1 必须 |
|--------|--------|----------|----------|:---:|
| P0 | `MarketCreated` | MarketFactory | 工厂创建新市场 | Y |
| P0 | `LiquidityInitialized` | BinaryPredictionMarket | 市场初始化流动性 | Y |
| P0 | `PositionBought` | BinaryPredictionMarket | 用户买入 YES/NO 份额 | Y |
| P0 | `PositionSold` | BinaryPredictionMarket | 用户卖出 YES/NO 份额 | Y |
| P0 | `MarketResolved` | BinaryPredictionMarket | 管理员裁决市场结果 | Y |
| P0 | `RewardClaimed` | BinaryPredictionMarket | 赢方领取奖励 | Y |
| P0 | `RefundClaimed` | BinaryPredictionMarket | 用户领取退款 | Y |
| P0 | `TreasuryRefundClaimed` | BinaryPredictionMarket | 国库扫尾退款 | Y |
| P0 | `FeeCollected` | BinaryPredictionMarket | 手续费收入 | Y |
| P1 | `ReservesUpdated` | BinaryPredictionMarket | AMM 储备变化 | Y |
| P1 | `MarketPaused` | BinaryPredictionMarket | 市场暂停 | Y |
| P1 | `MarketUnpaused` | BinaryPredictionMarket | 市场恢复 | Y |
| P2 | `ProtocolFeeUpdated` | FeeRouter | 协议费率变更 | N |
| P2 | `MaxSlippageUpdated` | FeeRouter | 最大滑点变更 | N |
| P2 | `TradeCapUpdated` | FeeRouter | 交易上限变更 | N |
| P2 | `TreasuryRecipientUpdated` | Treasury | 国库收款地址变更 | N |
| P2 | `TreasurySwept` | Treasury | 国库资金转出 | N |
| P2 | `ResolutionIssued` | AdminOracleResolver | 裁决者裁决（冗余事件） | N |

### 2.2 各事件详细字段

#### 2.2.1 MarketCreated

```text
合约：MarketFactory
触发场景：调用 factory 创建新市场
参数：
  - (indexed) marketId: uint256        -- 市场 ID，从 0 开始递增
  - (indexed) marketAddress: address   -- 新部署的市场合约地址
  - (indexed) creator: address         -- 创建者地址
  - question: string                   -- 市场问题文本
  - collateral: address                -- 抵押代币地址
  - startTime: uint64                  -- 市场开始时间戳
  - endTime: uint64                    -- 市场结束时间戳
  - initialCollateral: uint256         -- 初始流动性金额
  - initialPriceYesBps: uint16         -- 初始 YES 价格（bps，10000 = 100%）
可推导业务数据：
  - 市场元数据（question, collateral, time window）
  - 用于 Market 表的初始创建记录
前端页面：
  - 市场列表页
  - 市场详情页
是否 Phase 1 必须索引：是
```

#### 2.2.2 LiquidityInitialized

```text
合约：BinaryPredictionMarket
触发场景：市场初始化 AMM 流动性
参数：
  - initialCollateral: uint256        -- 初始质押金额
  - initialPriceYesBps: uint16        -- 初始 YES 价格（bps）
关键字段说明：
  - 此事件无 indexed 参数，需注意事件查询效率
可推导业务数据：
  - 市场初始流动性状态
  - 可用于计算初始 yesReserve / noReserve
前端页面：
  - 市场详情页（展示初始流动性）
是否 Phase 1 必须索引：是
```

#### 2.2.3 PositionBought

```text
合约：BinaryPredictionMarket
触发场景：用户买入 YES 或 NO 份额
参数：
  - (indexed) marketId: uint256       -- 市场 ID
  - (indexed) user: address           -- 用户地址
  - side: uint8                       -- 买入方向：1 = YES, 2 = NO
  - collateralIn: uint256             -- 用户支付的抵押品
  - sharesOut: uint256                -- 用户获得的份额
  - fee: uint256                      -- 支付的手续费
  - priceAfter: uint256               -- 交易后价格（bps）
可推导业务数据：
  - 交易记录（Trade 表）
  - 用户仓位增加（UserPosition.yesShares 或 .noShares 增加）
  - 手续费记录（FeeRecord 表）
  - 更新 AMM 储备金（ReservesUpdated 会随后发出）
前端页面：
  - 交易历史页
  - 用户持仓页
  - 市场详情页（交易列表）
是否 Phase 1 必须索引：是
```

#### 2.2.4 PositionSold

```text
合约：BinaryPredictionMarket
触发场景：用户卖出 YES 或 NO 份额
参数：
  - (indexed) marketId: uint256       -- 市场 ID
  - (indexed) user: address           -- 用户地址
  - side: uint8                       -- 卖出方向：1 = YES, 2 = NO
  - sharesIn: uint256                 -- 用户卖出的份额
  - collateralOut: uint256            -- 用户获得的抵押品
  - fee: uint256                      -- 支付的手续费
  - priceAfter: uint256               -- 交易后价格（bps）
可推导业务数据：
  - 交易记录（Trade 表）
  - 用户仓位减少
  - 手续费记录（FeeRecord 表）
前端页面：
  - 交易历史页
  - 用户持仓页
是否 Phase 1 必须索引：是
```

#### 2.2.5 MarketResolved

```text
合约：BinaryPredictionMarket
触发场景：裁决者调用 resolve() 决定市场结果
参数：
  - (indexed) marketId: uint256       -- 市场 ID
  - outcome: Outcome                  -- 结算结果枚举
  - (indexed) resolver: address       -- 裁决者地址
  - evidenceURI: string               -- 证据 URI（可能为空字符串）
Outcome 枚举值：
  - 0: Unset（未设置）
  - 1: Yes
  - 2: No
  - 3: Cancelled（取消）
  - 4: Invalid（无效）
可推导业务数据：
  - 市场结算记录（ResolutionRecord 表）
  - 更新 Market 表的 status 和 outcome 字段
前端页面：
  - 市场详情页（结算结果展示）
  - 用户 claim 页
是否 Phase 1 必须索引：是
```

#### 2.2.6 RewardClaimed

```text
合约：BinaryPredictionMarket
触发场景：赢方调用 claimReward() 领取奖励
参数：
  - (indexed) marketId: uint256       -- 市场 ID
  - (indexed) user: address           -- 用户地址
  - payout: uint256                   -- 领取金额
可推导业务数据：
  - 领取记录（ClaimRecord 表，claimType = "reward"）
  - 更新 UserPosition.claimed 标记
前端页面：
  - 用户 claim 记录页
  - 用户持仓页
是否 Phase 1 必须索引：是
```

#### 2.2.7 RefundClaimed

```text
合约：BinaryPredictionMarket
触发场景：用户调用 claimRefund() 领取退款（Cancelled/Invalid 市场）
参数：
  - (indexed) marketId: uint256       -- 市场 ID
  - (indexed) user: address           -- 用户地址
  - yesShares: uint256                -- 退还的 YES 份额
  - noShares: uint256                 -- 退还的 NO 份额
  - refundAmount: uint256             -- 退款金额
可推导业务数据：
  - 退款记录（ClaimRecord 表，claimType = "refund"）
前端页面：
  - 用户 claim 记录页
是否 Phase 1 必须索引：是
```

#### 2.2.8 TreasuryRefundClaimed

```text
合约：BinaryPredictionMarket
触发场景：Treasury 调用 sweepTreasuryRefund() 扫尾退款
参数：
  - (indexed) marketId: uint256       -- 市场 ID
  - refundAmount: uint256             -- 退款金额
可推导业务数据：
  - 国库退款记录（ClaimRecord 表，claimType = "treasury_refund"）
  - 注意：此事件没有 user 字段，属于系统级操作
前端页面：
  - 市场结算记录页
是否 Phase 1 必须索引：是
```

#### 2.2.9 FeeCollected

```text
合约：BinaryPredictionMarket
触发场景：每次 buy/sell 交易后自动触发
参数：
  - (indexed) marketId: uint256       -- 市场 ID
  - amount: uint256                   -- 手续费金额
  - (indexed) to: address             -- 手续费接收地址（Treasury）
可推导业务数据：
  - 手续费记录（FeeRecord 表，feeType = "trade"）
  - 注意：PositionBought/PositionSold 中已包含 fee 字段
    此事件可选择记录单独的 FeeRecord，也可在 Trade 表中计算
前端页面：
  - 手续费统计页（可选）
是否 Phase 1 必须索引：是
```

#### 2.2.10 MarketPaused / MarketUnpaused

```text
合约：BinaryPredictionMarket
触发场景：管理员调用 pause() / unpause()
参数：
  - (indexed) marketId: uint256       -- 市场 ID
可推导业务数据：
  - 更新 Market 表的 status 字段
前端页面：
  - 市场详情页（状态展示）
是否 Phase 1 必须索引：是
```

#### 2.2.11 ReservesUpdated

```text
合约：BinaryPredictionMarket
触发场景：每次交易后自动触发，记录最新的 AMM 储备金状态
参数：
  - (indexed) marketId: uint256       -- 市场 ID
  - yes: uint256                      -- 当前 YES 储备金
  - no: uint256                       -- 当前 NO 储备金
可推导业务数据：
  - 更新 Market 表的 yesReserve / noReserve 字段
  - 可用于计算当前 YES/NO 价格
  - 注意：此事件在每次 buy/sell 后都会发出
    Indexer 应更新 Market 表中的储备快照，但不需为每次更新创建新行
前端页面：
  - 市场详情页（实时价格展示）
是否 Phase 1 必须索引：是
```

---

## 3. 数据模型设计

### 3.0 唯一索引策略

所有链上事件的唯一性由 `(chainId, txHash, logIndex)` 三元组保证。Indexer 导入时使用此三元组去重，确保幂等处理。

### 3.1 Market

```text
表名：OnchainMarket
字段：
  id:                String   @id                              -- 自动生成 UUID 或 `${chainId}_${marketAddress}`
  chainId:           Int                                       -- 链 ID（BSC Testnet = 97）
  marketAddress:     String                                    -- 市场合约地址（bytes20 hex，小写）
  factoryAddress:    String                                    -- 工厂合约地址
  marketId:          Int                                       -- 合约内 marketId（uint256，从 0 开始）
  question:          String                                    -- 市场问题文本 ✅ 来自 MarketCreated 事件
  metadataURI:       String?                                   -- 元数据 URI（链上 public 变量，需额外链上读取）
  collateralToken:   String                                    -- 抵押代币地址 ✅ 来自 MarketCreated 事件
  creator:           String                                    -- 创建者地址 ✅ 来自 MarketCreated 事件 indexed
  startTime:         Int                                       -- 开始时间 Unix timestamp ✅ 来自 MarketCreated 事件
  endTime:           Int                                       -- 结束时间 Unix timestamp ✅ 来自 MarketCreated 事件
  status:            MarketStatus                               -- 市场状态枚举，同合约 MarketStatus
  outcome:           Outcome?                                  -- 结算结果枚举，同合约 Outcome
  evidenceURI:       String?                                   -- 证据 URI ✅ 来自 MarketResolved 事件
  ammEngine:         String?                                   -- AMM 引擎地址（链上 public，需额外读取）
  feeBps:            Int?                                      -- 手续费（bps，链上 public）
  yesReserve:        String?                                   -- YES 储备金 ✅ 来自 ReservesUpdated 事件
  noReserve:         String?                                   -- NO 储备金 ✅ 来自 ReservesUpdated 事件
  totalLiquidity:    String?                                   -- 初始流动性 ✅ 来自 LiquidityInitialized 事件
  createdAtBlock:    Int                                       -- 创建区块号（从 MarketCreated 日志）
  createdAtTx:       String                                    -- 创建交易哈希
  resolvedAtBlock:   Int?                                      -- 结算区块号
  resolvedAtTx:      String?                                   -- 结算交易哈希
  resolvedAtTime:    Int?                                      -- 结算时间戳（链上 public resolvedAt，需额外读取）
  lastUpdatedBlock:  Int                                       -- 最后更新区块号

枚举：MarketStatus: Active, Paused, Resolved, Cancelled, Invalid
枚举：Outcome: Unset, Yes, No, Cancelled, Invalid
```

### 3.2 UserPosition

```text
表名：OnchainPosition
字段：
  id:                String   @id                              -- `${chainId}_${marketAddress}_${userAddress}`
  chainId:           Int
  marketAddress:     String
  userAddress:       String                                    -- 用户地址（bytes20 hex，小写）
  yesShares:         String                                    -- YES 份额（通过 PositionBought/PositionSold 事件累计推导）
  noShares:          String                                    -- NO 份额（通过 PositionBought/PositionSold 事件累计推导）
  netCollateralIn:   String                                    -- 净流入抵押品（通过 buy/sell collateralIn/collateralOut 累计推导）
  netCollateralOut:  String                                    -- 净流出抵押品
  claimableEstimate: String?                                   -- 可领取估算值 ⚠️ Phase 1 为估算，精确值需合约实时计算
  claimed:           Boolean @default(false)                   -- 是否已领取 ✅ 来自 RewardClaimed / RefundClaimed 事件
  lastUpdatedBlock:  Int                                       -- 最后更新区块号
  lastUpdatedTx:     String                                    -- 最后更新交易哈希

注意：
  1. yesShares / noShares 通过 PositionBought 和 PositionSold 事件累计推导：
     - buy YES:  yesShares += sharesOut
     - buy NO:   noShares += sharesOut
     - sell YES: yesShares -= sharesIn
     - sell NO:  noShares -= sharesIn
  2. 当用户执行 claimReward 或 claimRefund 后，对应 shares 归零需后处理
  3. Phase 1 不支持实时计算 claimable，仅设置为空或标记为"合约实时计算"
  4. 此表为事件快照，非链上精确映射；精确持仓应以合约公众变量为准
```

### 3.3 Trade

```text
表名：OnchainTrade
字段：
  id:                String   @id                              -- `${chainId}_${txHash}_${logIndex}`
  chainId:           Int
  marketAddress:     String
  userAddress:       String
  side:              Side                                      -- 交易方向：YES / NO
  action:            TradeAction                               -- 操作类型：BUY / SELL
  collateralAmount:  String                                    -- 抵押品金额（buy 的 collateralIn 或 sell 的 collateralOut）
  sharesAmount:      String                                    -- 份额数量（buy 的 sharesOut 或 sell 的 sharesIn）
  feeAmount:         String                                    -- 手续费金额
  priceAfter:        String?                                   -- 交易后价格（bps）⚠️ 仅 BinaryPredictionMarket 提供
  txHash:            String
  blockNumber:       Int
  timestamp:         Int                                       -- 区块时间戳（Unix second）

枚举：Side: YES, NO
枚举：TradeAction: BUY, SELL
```

### 3.4 FeeRecord

```text
表名：OnchainFeeRecord
字段：
  id:                String   @id                              -- `${chainId}_${txHash}_${logIndex}`
  chainId:           Int
  marketAddress:     String
  payer:             String?                                   -- 手续费支付者 ⚠️ FeeCollected 事件无 payer 字段
  feeAmount:         String                                    -- 手续费金额 ✅ 来自 FeeCollected.amount
  feeType:           FeeType                                   -- 手续费类型：TRADE / PROTOCOL
  recipient:         String                                    -- 手续费接收地址 ✅ 来自 FeeCollected.to（indexed）
  txHash:            String
  blockNumber:       Int
  timestamp:         Int

枚举：FeeType: TRADE, PROTOCOL

注意：
  FeeCollected 事件无 payer 字段。如需关联具体用户，可通过同一 tx 中的
  PositionBought/PositionSold 事件的 user 字段推导。
  Phase 1 可先记录 feeAmount 和 recipient，payer 设为 null 或通过同一 tx 匹配。
```

### 3.5 ResolutionRecord

```text
表名：OnchainResolutionRecord
字段：
  id:                String   @id                              -- `${chainId}_${txHash}_${logIndex}`
  chainId:           Int
  marketAddress:     String
  marketId:          Int                                       -- 链上 marketId ✅ 来自 MarketResolved.marketId（indexed）
  outcome:           Outcome                                   -- 结算结果枚举 ✅ 来自 MarketResolved.outcome
  resolver:          String                                    -- 裁决者地址 ✅ 来自 MarketResolved.resolver（indexed）
  evidenceURI:       String?                                   -- 证据 URI ✅ 来自 MarketResolved.evidenceURI
  txHash:            String
  blockNumber:       Int
  timestamp:         Int

枚举：Outcome: 0 = Unset, 1 = Yes, 2 = No, 3 = Cancelled, 4 = Invalid
```

### 3.6 ClaimRecord

```text
表名：OnchainClaimRecord
字段：
  id:                String   @id                              -- `${chainId}_${txHash}_${logIndex}`
  chainId:           Int
  marketAddress:     String
  marketId:          Int                                       -- 链上 marketId ✅ 来自事件 indexed 参数
  userAddress:       String?                                   -- 用户地址 ⚠️ TreasuryRefundClaimed 无此字段
  amount:            String                                    -- 领取/退款金额
  claimType:         ClaimType                                 -- 领取类型
  yesShares:         String?                                   -- 退还 YES 份额（仅 RefundClaimed）
  noShares:          String?                                   -- 退还 NO 份额（仅 RefundClaimed）
  txHash:            String
  blockNumber:       Int
  timestamp:         Int

枚举：ClaimType: REWARD, REFUND, TREASURY_REFUND

注意：
  RewardClaimed 的 amount 字段名为 payout，RefundClaimed 为 refundAmount。
  TreasuryRefundClaimed 无 userAddress，记录为 null。
```

### 3.7 IndexerSyncState

```text
表名：OnchainIndexerSyncState
字段：
  id:                String   @id                              -- `${chainId}_${contractAddress}`
  chainId:           Int
  contractAddress:   String                                    -- 被监听的合约地址
  contractType:      String                                    -- 合约类型：MarketFactory / BinaryPredictionMarket
  lastProcessedBlock: Int
  lastProcessedTx:   String?
  lastProcessedLogIndex: Int?
  status:            SyncStatus                                -- 同步状态
  eventCount:        Int?                                      -- 已处理事件数
  errorMessage:      String?                                   -- 最后一次错误信息
  startedAt:         DateTime
  updatedAt:         DateTime                                  -- 最后同步时间

枚举：SyncStatus: SYNCING, CAUGHT_UP, ERROR, STOPPED

用途：
  Indexer 重启时从此表恢复同步进度。
  使用轮询模式时，每次处理完一个区块后更新 lastProcessedBlock。
```

---

## 4. 数据来源限制说明

### 4.1 可直接从事件获得

| 数据项 | 来源事件 | 说明 |
|--------|----------|------|
| market question | MarketCreated | ✅ 问题文本在 MarketCreated 的 question 字段中 |
| creator | MarketCreated | ✅ indexed creator 字段 |
| collateralToken | MarketCreated | ✅ collateral 字段 |
| startTime / endTime | MarketCreated | ✅ startTime / endTime 字段 |
| 买入/卖出交易 | PositionBought / PositionSold | ✅ 完整的交易参数 |
| 结算结果 | MarketResolved | ✅ outcome 枚举 |
| 用户领取 | RewardClaimed / RefundClaimed | ✅ 金额和类型 |
| 储备金 | ReservesUpdated | ✅ yes / no 储备金 |

### 4.2 需链上额外读取

| 数据项 | 链上来源 | 说明 |
|--------|----------|------|
| metadataURI | BinaryPredictionMarket.metadataURI() | 事件中无此字段 |
| ammEngine | BinaryPredictionMarket.ammEngine() | 事件中无此字段 |
| feeBps | BinaryPredictionMarket.feeBps() | 事件中无此字段 |
| resolvedAt（时间戳） | BinaryPredictionMarket.resolvedAt() | MarketResolved 事件无 resolvedAt |
| 市场状态 | BinaryPredictionMarket.status() | 可通过事件推导但建议同步验证 |
| 当前储备金 | BinaryPredictionMarket.R_yes() / R_no() | ReservesUpdated 事件可替代 |

### 4.3 Phase 1 不支持

| 数据项 | 原因 |
|--------|------|
| claimable 精确计算 | 需调用合约 `_calculatePayout()` 方法，涉及储备金和总份额的链上暂态计算 |
| 用户当前精确持仓 | 链上 `yesShares[user]` / `noShares[user]` 需单独 viem 读取 |
| 价格历史 K 线 | ReservesUpdated 仅在交易后触发，无法提供连续的价格时间序列 |
| 用户操作的时间线合并 | 多个事件分散在不同区块中，Phase 1 不做复杂的事件关联 |

---

## 5. 技术选型比较

### 5.1 候选方案

#### 方案 A：Node.js + viem + Prisma + PostgreSQL（最小自研）

| 维度 | 内容 |
|------|------|
| GitHub | `viem`: https://github.com/wevm/viem — MIT License |
|        | `Prisma`: https://github.com/prisma/prisma — Apache 2.0 |
| 优点 | 完全可控、无额外依赖、与现有栈一致、调试方便、轻量级 |
| 缺点 | 需手写事件处理逻辑、断点恢复逻辑、去重逻辑、同步进度管理 |
| 适合 BSC Testnet | ✅ viem 原生支持 BSC |
| 适合 Phase 1 | ✅ 最低概念复杂度 |
| 托管需求 | 仅需 PostgreSQL 实例（本地开发用 Docker / pg 即可） |
| 建议 PR-19 使用 | ✅ **强烈推荐** |

#### 方案 B：Ponder

| 维度 | 内容 |
|------|------|
| GitHub | https://github.com/ponder-sh/ponder — MIT License |
| 优点 | TypeScript native、配置文件驱动、自动生成 GraphQL API、内置去重和断点恢复、开箱即用 |
| 缺点 | 引入新框架（~117MB）、需学习 schema.graphql 语法、自动生成 API 可能不完全匹配前端需求 |
| 适合 BSC Testnet | ✅ 支持（通过 viem transport 配置） |
| 适合 Phase 1 | ✅ 但引入概念负担 |
| 托管需求 | 需运行 Ponder 服务 + PostgreSQL |
| 建议 PR-19 使用 | ⚠️ 可选，但非必要 |

#### 方案 C：The Graph

| 维度 | 内容 |
|------|------|
| GitHub | https://github.com/graphprotocol/graph-node — Apache 2.0 |
| 优点 | 业界最成熟的去中心化索引协议、Subgraph Studio 免费托管、GraphQL 生态丰富 |
| 缺点 | AssemblyScript 写映射逻辑（非 TypeScript）、本地开发需 graph-node + IPFS + PostgreSQL 完整栈、部署流程重 |
| 适合 BSC Testnet | ✅ Hosted Service 支持 |
| 适合 Phase 1 | ❌ 太重，AssemblyScript 学习成本高，不匹配项目 TypeScript 技术栈 |
| 托管需求 | 需 The Graph Hosted Service 或自建 graph-node |
| 建议 PR-19 使用 | ❌ 不推荐 |

#### 方案 D：Subsquid

| 维度 | 内容 |
|------|------|
| GitHub | https://github.com/subsquid/squid-sdk — MIT License |
| 优点 | TypeScript native、支持多链、批处理事件、Archive 数据高效 |
| 缺点 | 引入完整 SDK 生态、需 Aquarium 云托管或自建、学习曲线陡峭 |
| 适合 BSC Testnet | ✅ 理论上支持 |
| 适合 Phase 1 | ❌ 过度工程，适合多链大规模索引场景 |
| 托管需求 | Aquarium 云托管 |
| 建议 PR-19 使用 | ❌ 不推荐 |

### 5.2 推荐结论

**推荐方案 A：Node.js + viem + Prisma + PostgreSQL（最小自研 Indexer）**

推荐理由：

1. **技术栈一致性**：项目已使用 viem（`^2.21.0`）、Prisma（`^6.19.2`）、PostgreSQL（`pg: ^8.17.2`），新增 Indexer 无需引入新依赖
2. **现有基础设施可复用**：`server/` 已有 NestJS 项目结构，Indexer 可以作为 NestJS 的一个模块嵌入
3. **最小可控**：Phase 1 只需监听 12 个事件，手写事件处理逻辑复杂度可控
4. **ABI 文件可用**：`packages/abi/` 下已有编译好的 ABI JSON，可直接被 viem 的 `parseAbi` 解析
5. **BSC Testnet 原生支持**：viem 已配置 BSC Testnet chain
6. **开发效率**：不引入新框架学习成本，开发者直接使用熟悉的 TypeScript
7. **未来扩展**：Phase 2 如需更强索引能力，可平滑迁移到 Ponder

如果团队强烈偏好开箱即用的方案，Ponder 是合适的备选。

---

## 6. 前端与 Indexer 接口边界

### 6.1 API 端点设计

Indexer 通过 NestJS REST API 向 Next.js 前端提供查询接口。

```text
GET  /api/indexer/markets
     - 查询参数：?status=Active&limit=20&offset=0
     - 返回：市场列表（含基本字段、当前储备金、价格估算）

GET  /api/indexer/markets/:marketAddress
     - 返回：单个市场详情（含所有状态、历史事件数量）

GET  /api/indexer/markets/:marketAddress/trades
     - 查询参数：?limit=50&offset=0&side=YES
     - 返回：该市场的交易历史

GET  /api/indexer/users/:address/positions
     - 返回：用户所有市场的持仓列表

GET  /api/indexer/users/:address/trades
     - 查询参数：?limit=50&offset=0&marketAddress=0x...
     - 返回：用户交易历史

GET  /api/indexer/users/:address/claims
     - 返回：用户 claim / refund 记录

GET  /api/indexer/sync/status
     - 返回：各合约的同步状态
     - 响应：{ factory: { lastBlock, status }, markets: [...] }
```

### 6.2 前端读取方式

- 通过 `fetch` / `axios` / React Query 调用 `http://localhost:3001/api/indexer/*`（NestJS 端口）
- 开发环境下 NestJS 和 Next.js 同时运行，前端通过 CORS 或 Next.js API Route 代理
- 如果 PR-19 使用 Ponder，则前端直接使用 Ponder 自动生成的 GraphQL endpoint：`http://localhost:42069/graphql`

### 6.3 本地开发环境

```text
Next.js (Frontend):   http://localhost:3000
NestJS (Server):      http://localhost:3001
PostgreSQL:           localhost:5432

PR-19 开发时需要同时启动 Next.js dev server 和 NestJS server。
```

### 6.4 部署方式

- Phase 1：本地开发 + 本地 PostgreSQL（Docker）
- BSC Testnet 验证：NestJS indexer 连接到 BSC Testnet RPC，拉取全部历史事件后进行增量监听
- Phase 1 **不做**生产服务器部署

---

## 7. PR-19 实现计划

### 7.1 推荐拆分

```text
PR-19-A：Indexer Scaffold + Event Listener Base
  - 在 server/ 下创建 indexer/ 模块
  - 实现 viem publicClient + watchContractEvent 基础框架
  - 实现 IndexerSyncState 的读/写/进度管理
  - 实现事件去重（chainId, txHash, logIndex）

PR-19-B：Database Schema
  - 新增 OnchainMarket / OnchainPosition / OnchainTrade / OnchainFeeRecord
    / OnchainResolutionRecord / OnchainClaimRecord / OnchainIndexerSyncState 表
  - Prisma 迁移

PR-19-C：Event Handlers
  - 为每个 P0/P1 事件实现 handler
  - 事件 → 数据库写入逻辑
  - 用户仓位累计推导逻辑
  - 市场状态机推导逻辑

PR-19-D：Query API
  - 实现 GET /api/indexer/markets
  - 实现 GET /api/indexer/markets/:marketAddress
  - 实现 GET /api/indexer/markets/:marketAddress/trades
  - 实现 GET /api/indexer/users/:address/positions
  - 实现 GET /api/indexer/users/:address/trades
  - 实现 GET /api/indexer/users/:address/claims
  - 实现 GET /api/indexer/sync/status

PR-19-E：Local Smoke Test
  - 连接 BSC Testnet
  - 从区块 0 回溯全部历史事件
  - 验证数据库记录与链上合约状态一致（抽样验证 3-5 个市场）
  - 验证增量事件监听正常
```

### 7.2 合并为单个 PR 的风险

如将 PR-19 所有部分合并，风险如下：

- **范围过大**：Event handlers + DB schema + Query API 总计约 1500-2000 行代码
- **测试困难**：Indexer 的测试依赖 BSC Testnet 实时事件，需要较长运行时间
- **合并冲突**：对 `server/prisma/schema.prisma` 的修改可能与现有 NestJS 模块冲突

**建议**：PR-19 拆分为 3 个 PR（PR-19-A+B 合并为一个 scaffold PR，PR-19-C+D 为功能 PR，PR-19-E 为验收 PR）。

---

## 8. 当前仓库栈与依赖信息

### 8.1 已安装可复用依赖

| 依赖 | 版本 | 位置 |
|------|------|------|
| viem | ^2.21.0 | server/package.json, package.json（^2.7.0） |
| @prisma/client | ^6.19.2 | server/package.json devDeps |
| prisma | ^6.19.2 | server/package.json devDeps |
| pg | ^8.17.2 | server/package.json |
| @nestjs/common | ^11.1.12 | server/package.json |
| @prisma/adapter-pg | ^7.3.0 | server/package.json |

### 8.2 已有 ABI 文件

| 文件 | 路径 |
|------|------|
| BinaryPredictionMarket.json | packages/abi/BinaryPredictionMarket.json |
| MarketFactory.json | packages/abi/MarketFactory.json |
| CPMMEngine.json | packages/abi/CPMMEngine.json |

### 8.3 PR-19 不需新增依赖

现有 viem + Prisma + NestJS 栈已足够实现 PR-19 的 Indexer。
如果未来引入 Ponder，需要新增 `@ponder/core` 依赖。

### 8.4 BSC Testnet 已部署合约

```text
MarketFactory: 0x45ab369f65c0ef44c1325323f283e6acc92b8bd0
CPMMEngine: 0x16fae185a854a54307f6dea9c0d53e326bb4f82f
Standalone BinaryPredictionMarket: 0x05caa8a264b2436f1851a58f4f183350fd330a2f
MockUSDT: 0xb90278a476319CbDAd259e4fEAA8E7d9Da05e1EB
Smoke-test market: 0x87445F25F78e3eeE91090C80BdeB2F1ae1296A07
```

---

## 9. 附录：事件索引优先级一览

| # | 事件 | 合约 | P | Phase 1 |
|---|------|------|---|:---:|
| 1 | MarketCreated | MarketFactory | P0 | Y |
| 2 | LiquidityInitialized | BinaryPredictionMarket | P0 | Y |
| 3 | PositionBought | BinaryPredictionMarket | P0 | Y |
| 4 | PositionSold | BinaryPredictionMarket | P0 | Y |
| 5 | MarketResolved | BinaryPredictionMarket | P0 | Y |
| 6 | RewardClaimed | BinaryPredictionMarket | P0 | Y |
| 7 | RefundClaimed | BinaryPredictionMarket | P0 | Y |
| 8 | TreasuryRefundClaimed | BinaryPredictionMarket | P0 | Y |
| 9 | FeeCollected | BinaryPredictionMarket | P0 | Y |
| 10 | ReservesUpdated | BinaryPredictionMarket | P1 | Y |
| 11 | MarketPaused | BinaryPredictionMarket | P1 | Y |
| 12 | MarketUnpaused | BinaryPredictionMarket | P1 | Y |
| 13 | ProtocolFeeUpdated | FeeRouter | P2 | N |
| 14 | MaxSlippageUpdated | FeeRouter | P2 | N |
| 15 | TradeCapUpdated | FeeRouter | P2 | N |
| 16 | TreasuryRecipientUpdated | Treasury | P2 | N |
| 17 | TreasurySwept | Treasury | P2 | N |
| 18 | ResolutionIssued | AdminOracleResolver | P2 | N |
