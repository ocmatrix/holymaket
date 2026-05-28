# XMarket → WANTOS Smart Option 开发边界规则 V1.2

## 1. 最高原则

要么不做，要么做成真实可用功能。

所有进入开发范围的功能必须满足：

- 真实链上执行
- 真实钱包签名
- 真实资金托管
- 真实买入
- 真实卖回
- 真实结算
- 真实 Claim / Refund
- 可测试、可验收、可审计、可真实使用

禁止：

- mock txHash
- 假交易
- 假 AMM
- 假结算
- 占位功能
- 半成品功能
- 以后必然推倒重来的核心资金逻辑
- 后端模拟真实交易结果
- 数据库伪造用户资金状态

## 2. 路线边界

采用：

跳过链下修补，直接链上重建。

禁止：

- 修补原链下 AMM
- 修补原 Round 结算
- 在 NestJS 里实现真实 AMM
- 在 NestJS 里实现派彩
- 在 NestJS 里模拟用户资金状态
- 在数据库里直接更改结算/赔付结果

约束：

- 真实交易逻辑全部放到 WANTOS Chain Solidity 合约
- 后端只做 Indexer + API + Admin + Auth + WebSocket + 运营模块
- 数据库只做链上事件缓存与聚合数据，不作为资金真相来源
- 链上状态永远是最终真实状态

## 3. Phase 1 功能边界

Phase 1 必须做成真实可用：

- createMarket（官方后台创建）
- 官方初始流动性（initialCollateral + initialPriceYesBps）
- buyYes
- buyNo
- sellYes
- sellNo
- resolve（链上）
- claim（链上）
- refund（Cancelled / Invalid）
- FeeRouter / Treasury 手续费归集（不破坏偿付能力）
- Indexer 监听链上事件并入库
- Market API / Portfolio API / WebSocket 推送
- Admin resolve 必须钱包签名发送链上交易
- 前端真实钱包交易（approve + buy/sell/claim/refund）

Phase 1 不做：

- CLOB
- P2P
- 自由转让
- ERC1155 可流通仓位
- 用户自由创建市场
- 杠杆
- 多结果市场
- DAO 仲裁
- AI 自动交易
- 自建全量行情系统
- Phase 2/3 的可转让资产化仓位

## 4. 仓位边界

Phase 1：

- 内部账本仓位：yesShares / noShares
- 允许 sell 卖回 AMM
- 不允许第三方转让

禁止：

- 用户之间转让 YES / NO
- ERC1155 safeTransferFrom
- operator 代转仓位
- P2P
- CLOB
- 外部合约接管用户仓位

说明：

- 内部账本是 Phase 1 产品定义下的正式实现，不是临时方案
- Phase 2 如开放自由转让，采用新市场版本（ERC1155 OutcomeToken），不强迁旧市场

## 5. 外部行情边界

平台交易行情：

- 由链上事件 + Indexer 生成
- 数据库仅缓存与聚合，不作为资金真相

外部真实世界行情：

- 只接第三方接口，不自建全量系统
- 外部行情只用于参考展示、市场创建参考、Admin 裁决参考、价格类自动结算输入

禁止：

- 外部行情直接决定用户 claim/refund
- 外部行情绕过链上 OracleResolver
- 数据库因为外部行情直接修改资金归属

## 6. 合约开发边界

Phase 1 允许实现的合约集合：

- MockUSDT
- MarketFactory（原子 createMarket）
- BinaryPredictionMarket（内部账本 + buy/sell + resolve/claim/refund）
- CPMMEngine（complete-set + CPMM 的 quote 与执行逻辑）
- AdminOracleResolver（RESOLVER_ROLE）
- Treasury（手续费归集）
- FeeRouter（费率上限与配置）

Phase 1 禁止：

- 完整 Gnosis Conditional Tokens（CTF）
- CLOB / orderbook settlement
- LMSR 作为默认生产 AMM
- 杠杆与复杂衍生品
- 用户自由创建市场
- 复制不明来源开源代码
- 复制 Polymarket / Kuest 的底层合约作为 Phase 1 生产代码

硬约束：

- 在 complete-set 偿付不变量与 Foundry 测试清单未最终确认前，不进入 AMM 完整实现

## 7. 后端开发边界

后端允许：

- Auth（含 Privy 服务端验证）
- Indexer（链上事件监听、去重、断点续扫、重放）
- API（市场列表、详情、交易历史、持仓聚合）
- Admin（市场创建参数管理、结算操作入口）
- Price Feed（第三方行情接入与缓存）
- WebSocket（推送链上行情与用户状态）
- 运营模块（quest/referral/notification/team/leaderboard）

后端禁止：

- 托管用户资金
- 代替用户签名
- 执行真实交易
- 生成假 txHash
- 执行链下派彩
- 在数据库里直接决定 claim/refund

## 8. 前端开发边界

前端允许：

- 使用 wagmi / viem 与 WANTOS EVM 交互
- 真实钱包签名交易
- approve + buy/sell/claim/refund
- 交易前 quote 展示（expectedOut、fee、priceImpact、minOut、priceAfter）
- 展示第三方行情参考

前端禁止：

- mock txHash
- 伪造交易成功
- 前端计算最终资金归属
- 绕过合约状态机
- 硬编码私钥、助记词或任何敏感密钥

## 9. 数据库边界

数据库只缓存：

- 链上事件（含 chainId/txHash/logIndex 的去重键）
- 聚合行情（K 线、成交、热度）
- 用户持仓视图（以链上为准的缓存视图）
- Admin 操作日志
- 第三方行情快照

数据库禁止：

- 伪造仓位
- 决定 claim/refund
- 直接修改资金归属
- 以数据库状态替代链上状态

## 10. Admin 权限边界

- Admin 只能通过钱包 / 多签发起链上交易
- 服务器不得持有 resolve 私钥
- oracle-admin 后端只做参数校验与 txRequest / calldata 生成
- Admin 不能直接改用户仓位、结算结果或资金归属

## 11. Agent 工作边界

每次任务必须：

- 小步执行
- 明确允许修改文件范围与禁止修改范围
- 提供验收命令与测试结果
- 输出变更摘要（diff 摘要）

Agent 禁止：

- 自行变更技术路线
- 自行引入新库或扩大依赖面
- 扩大任务范围
- 一次性改全项目
- 在测试失败情况下继续推进实现

## 12. 开工前强制任务

正式业务开发前必须完成：

1. Prisma schema 恢复（schema.prisma + validate + generate）
2. 安全止血（密钥轮换、弱口令移除、Privy 服务端验证）
3. WANTOS EVM 兼容性验证（部署 ERC20、approve、事件监听）
4. Foundry 项目初始化（依赖、配置、基本构建）
5. complete-set + CPMM 数学测试清单确认（含 buy/sell rounding、不变量、fuzz）

