# XMarket → WANTOS Smart Option 架构蓝图 V1.2

## 1. 项目定位

XMarket 不再作为链下 PTS / 模拟预测平台继续修补，而是升级为：

WANTOS Chain 原生 Smart Option / Event Prediction / Prediction Trading Protocol。

目标是在 WANTOS Chain 上建设一个真实可用的链上预测交易系统。用户使用 WANTOS Chain 上的 bridged USDT / USDC 或 MockUSDT 参与二元预测市场交易。

WANTOS Chain（Cosmos EVM）基础参数（主网）：

- Network Name: WANTOS
- RPC URL: https://rpc.wantos.io
- Chain ID: 13555
- Currency Symbol: WANT
- Explorer URL: https://explorer.wantos.io
- Block Time: ~3s
- Gas: 支持 EIP-1559 动态费用

技术栈：

- WANTOS Chain / Cosmos EVM
- Solidity
- Foundry
- OpenZeppelin
- Next.js / XMarket Frontend
- NestJS Indexer / API / Admin
- PostgreSQL / Prisma
- 第三方外部行情接口

## 2. 路线选择

采用路线 B：

跳过链下修补，直接重建为 WANTOS Chain 链上预测协议。

原因：

- XMarket 当前原 AMM / Market / Round / Price / use-prediction 逻辑是 stub 或 mock。
- 如果先在 NestJS 中实现链下 AMM / 结算 / 派彩，Phase 2 上链时仍需要在 Solidity 里重写一遍，属于重复开发与技术债。

冻结原则：

- 不修补原链下 AMM
- 不修补原链下 Round 结算
- 不在 NestJS 里写真实交易逻辑
- 不在 NestJS 里写真实派彩逻辑
- 不在数据库里模拟/伪造用户资金状态
- 真实交易逻辑全部放在 WANTOS Chain Solidity 合约
- 后端只做 Indexer + API + Admin + Auth + WebSocket + 运营模块

## 3. Phase 1 生产可用受控版

Phase 1 是功能边界收窄、但每个功能真实可用的生产第一版。

Phase 1 做：

- 官方后台创建二元预测市场
- 官方提供初始流动性
- 用户买 YES
- 用户买 NO
- 用户卖 YES 回 AMM
- 用户卖 NO 回 AMM
- 不允许第三方转让
- 不开放 CLOB
- 不开放 P2P
- 不开放用户自由创建市场
- Admin / Oracle 链上结算
- 赢方 Claim
- Cancelled / Invalid Refund
- 手续费进入 Treasury
- Indexer 监听链上事件
- 前端真实钱包签名交易
- 平台交易行情由链上事件生成
- 外部真实世界行情接第三方接口，不自建

Phase 1 不做：

- 自由转让仓位
- ERC1155 可流通仓位
- CLOB 订单簿
- 用户对用户交易
- 杠杆
- 多结果市场
- 用户自由创建市场
- DAO 仲裁
- AI 自动交易
- 跨链订单簿
- 自建全量外部行情系统

## 4. 仓位流动性规则

Phase 1 仓位流动性规则：

允许 sell 卖回 AMM，但不允许第三方转让。

采用内部账本记录仓位：

- yesShares[user]
- noShares[user]

禁止：

- 用户之间转让 YES / NO
- ERC1155 safeTransferFrom
- 第三方 operator 代转仓位
- P2P
- CLOB
- 外部合约接管用户仓位

内部账本不是临时代码，而是 Phase 1 产品定义下的正式实现。

Phase 2 如开放自由转让，再部署 ERC1155 OutcomeToken / CLOB 新版本市场，不强迁旧市场。

## 5. 官方初始流动性规则

没有官方初始流动性，不允许创建可交易市场。

市场创建参数（Phase 1 统一口径）：

- initialCollateral
- initialPriceYesBps
- minTradeAmount
- maxTradeAmount
- maxSlippageBps
- feeBps
- startTime
- endTime
- question / metadataURI

价格范围：

- minInitialPriceYesBps = 3000
- maxInitialPriceYesBps = 7000
- defaultInitialPriceYesBps = 5000

创建约束：

- initialCollateral >= minInitialCollateral
- maxTradeAmount <= initialCollateral * tradeCapBps / 10000
- feeBps <= systemMaxFeeBps
- maxSlippageBps <= systemMaxSlippageBps

市场创建必须原子化：

createMarket() 一次性完成：

- 参数校验
- 从 creator / treasury 转入 initialCollateral
- 部署 BinaryPredictionMarket
- 初始化 reserves
- 初始化 treasury inventory
- 进入 Active（或按 startTime 进入可交易窗口）
- emit MarketCreated
- emit LiquidityInitialized

禁止：

- PendingLiquidity
- initLiquidity()
- 半初始化市场状态

## 6. Complete-set + CPMM 模型

Phase 1 使用 complete-set 全抵押模型与 CPMM 做市：

- 每 1 collateral 对应 1 YES + 1 NO complete set
- CPMM 管理 YES / NO reserves
- 用户 buy 时：扣 fee → 净额 mint pair → 与 AMM swap 得到目标方向 shares
- 用户 sell 时：与 AMM swap → merge → 释放 collateral
- 手续费不能破坏偿付能力，且必须与赔付池隔离

关键状态变量（建议标准字段）：

- collateralLocked
- pairSupply
- totalYesSupply
- totalNoSupply
- R_yes
- R_no
- totalUserYesShares
- totalUserNoShares
- yesShares
- noShares
- treasuryYes
- treasuryNo
- totalFeesCollected
- claimedFinalPayout

不变量（Phase 1 必须长期成立）：

- I1：collateralLocked == pairSupply
- I2：totalYesSupply == pairSupply 且 totalNoSupply == pairSupply
- I3：R_yes + treasuryYes + totalUserYesShares == totalYesSupply
- I4：R_no + treasuryNo + totalUserNoShares == totalNoSupply
- I5：手续费与赔付池隔离，fee 不计入 collateralLocked
- I6：market 合约的 collateral 余额必须覆盖 collateralLocked
- I7：YES / NO / Cancelled / Invalid 的最大 payout 总额不得超过 collateralLocked

账户分层设计（Phase 1 定稿）：

- AMM reserves：R_yes / R_no，用于交易定价、买入、卖回
- Treasury inventory：treasuryYes / treasuryNo，作为官方初始库存，不可交易、不可转让，只按合约规则在结算/取消时处理

硬规则：

- treasuryYes / treasuryNo 不能被 Admin 手动提取、转移、修改
- treasuryYes / treasuryNo 只能由以下合约规则改变：市场初始化、官方追加流动性（如 Phase 1 允许）、结算 claim、取消/无效退款

## 7. Cancelled / Invalid 退款规则

Cancelled / Invalid 定稿退款规则：

refundAmount = (yesShares[user] + noShares[user]) / 2

要求：

- 一律向下取整
- rounding dust 归 Treasury
- 用户独立计算与独立领取，不需要遍历用户
- 防止重复 refund（claimedFinalPayout 必须拦截）
- 已 sell 的 shares 不会重复退款（sell 已扣减 shares，剩余 shares 才能 refund）
- Cancelled / Invalid 走 refund，不走 claim

Treasury 处理（Phase 1 定稿）：

- 设置 refundWindow（例如 30 天或 90 天，具体由治理/配置确定）
- refundWindow 内用户可 refund
- refundWindow 结束后，剩余 collateral 归 Treasury
- 不要求链上等待所有用户 refund（链上无法遍历用户集合）

## 8. 外部行情原则

区分两类行情。

平台自身交易行情：

- 来源：链上事件 → Indexer → 数据库缓存 → API / WebSocket → 前端
- 生成内容：YES / NO 当前价格、成交记录、交易量、市场热度、用户持仓、PnL、K 线、排行榜

外部真实世界行情：

- Phase 1 不自建，只接第三方接口
- 可接入：Binance API、CoinGecko、Pyth、Band、Slinky
- 后期扩展：Sports API、NewsAPI、GDELT、Polymarket reference odds

Phase 1 优先支持价格类市场。外部行情只用于：

- 市场创建参考
- 前端展示参考
- Admin / Oracle 裁决参考
- 价格类自动结算输入

最终结算必须写入链上合约，数据库不得直接决定用户资金归属。

## 9. 合约架构

目录建议：

```txt
contracts/
├── foundry.toml
├── src/
│   ├── tokens/
│   │   └── MockUSDT.sol
│   ├── market/
│   │   ├── MarketFactory.sol
│   │   └── BinaryPredictionMarket.sol
│   ├── pricing/
│   │   ├── IAMMEngine.sol
│   │   └── CPMMEngine.sol
│   ├── settlement/
│   │   └── AdminOracleResolver.sol
│   ├── fees/
│   │   ├── Treasury.sol
│   │   └── FeeRouter.sol
│   └── interfaces/
├── test/
└── script/
```

直接使用：

- OpenZeppelin
- Foundry
- Cosmos EVM

谨慎参考：

- Gnosis Conditional Tokens
- Polymarket CTF Exchange / V2
- Kuest
- viral-sangani / Polymarket-clone
- Polymarket SDK

禁止 Phase 1：

- 完整 Gnosis CTF
- CLOB
- LMSR 作为默认生产 AMM
- 复制 Polymarket 合约
- 复制 Kuest 底层

## 10. 后端架构

NestJS 后端职责：

- Auth
- User
- Admin
- Indexer
- Market API
- Portfolio API
- Oracle Admin API
- Price Feed API
- WebSocket
- Quest / Referral / Notification / Team

新增模块：

- chain/
- indexer/
- market-api/
- portfolio/
- oracle-admin/
- price-feed/
- contract-config/

废弃或改造：

- amm/
- market/
- round/
- price/

后端原则：

- 后端不托管资金
- 后端不代替用户签名
- 后端不执行真实交易
- 后端不执行链下结算
- 后端不生成假 txHash
- 数据库只缓存链上事件与聚合数据

## 11. Prisma / 数据库架构

当前状态：

- server/prisma/schema.prisma 缺失
- server/prisma/migrations 存在
- server/prisma/seed.ts 存在

恢复流程：

1. 修复 Prisma CLI 权限
2. 先写最小 schema.prisma，只包含 datasource + generator
3. 用 8 个 migration.sql 重放数据库
4. prisma db pull 反向生成 schema
5. prisma format
6. prisma validate
7. prisma generate

恢复后新增链上索引表（Phase 1 设计目标）：

- OnchainMarket
- OnchainTrade
- OnchainPosition
- ChainEvent
- OracleResult
- ClaimRecord
- ContractConfig
- MarketPriceSnapshot
- PriceFeedSnapshot
- AdminActionLog

唯一索引建议：

- (chainId, txHash, logIndex)

Indexer 参数建议：

- confirmations = 2~3
- reorgWindowBlocks = 20

## 12. 前端架构

前端保留 XMarket UI 资产，但交易逻辑必须替换为真实链上交互。

使用：

- wagmi
- viem
- WANTOS EVM chain config

必须支持：

- 自动识别 WANTOS Chain
- 一键添加 WANTOS EVM
- 读取 collateral 余额
- approve
- buyYes / buyNo
- sellYes / sellNo
- claim
- refund
- Admin resolve / cancel / invalid
- 展示第三方行情参考
- 显示 quote、fee、priceImpact、minOut、priceAfter

禁止：

- mock txHash
- 伪造交易成功
- 前端自己维护资金账本
- 前端直接决定用户 claim/refund

## 13. Admin 后台

Admin 后台能力：

- 创建市场
- 设置初始 collateral
- 设置初始价格
- 设置手续费
- 设置 min/max trade
- 设置 max slippage
- 查看第三方行情参考
- 暂停市场
- 结算市场
- 标记 Cancelled / Invalid
- 发起链上交易
- 记录 AdminActionLog

重要原则：

- Admin resolve 必须由管理员钱包或多签签名
- 服务器不得持有 resolve 私钥
- oracle-admin 后端只做参数校验和 txRequest / calldata 生成
- 最终交易由 admin-web 钱包签名发送

## 14. 安全要求

P0 安全任务（Phase 1 开工前必须完成）：

- 清除 .env git 历史
- 轮换所有密钥
- 删除 Admin fallback secret
- 修复 Privy 服务端验证
- 删除默认弱密码
- 所有写接口加 JWT Guard
- 部署脚本禁止硬编码私钥
- 合约使用 OpenZeppelin 安全组件

合约必须测试：

- 重入
- 重复 claim
- 重复 refund
- 错误结算
- 非授权结算
- 暂停交易
- 手续费隔离（I5/I6）
- 滑点保护
- sell 超过仓位
- resolved 后不能 buy/sell
- cancelled/invalid 后不能 claim
- resolved 后不能 refund
- createMarket 初始化不变量（I1-I7）
- refundWindow 结束后剩余资金归 Treasury

## 15. 开发顺序

- Step 0：规则冻结
- Step 1：Prisma schema 恢复
- Step 2：安全止血
- Step 3：WANTOS EVM 兼容性验证
- Step 4：Foundry 合约骨架
- Step 5：complete-set + CPMM 数学测试清单确认与实现
- Step 6：合约生产闭环（createMarket/buy/sell/resolve/claim/refund）
- Step 7：Indexer / API
- Step 8：前端真实链上接入
- Step 9：测试网验收

