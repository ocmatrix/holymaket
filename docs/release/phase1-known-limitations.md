# XMarket Phase 1 Known Limitations

本文件用于记录 Phase 1 的已知限制与边界。它们是 Phase 1 范围内的明确取舍，不应被解读为失败或阻断项；如需扩展，进入 Phase 2 再处理。

## 1. 网络范围

- 当前仅在 BSC Testnet 验证（Chain ID: 97）
- 不包含主网部署，不提供主网参数与生产发布流程

## 2. 资产与抵押物

- 使用 MockUSDT，不是真实 USDT
- 不包含真实资产接入、清结算或合规流程

## 3. 市场数据来源

- 当前市场数据主要来自测试网 smoke-test market（用于 Phase 1 端到端打通与演示）
- Market question / collateralToken 仍可能是最小字段，未做完整 metadata 回填与管理面板维护

## 4. Indexer 运行形态

- Indexer 当前为本地 / 自托管模式
- 不包含托管、扩容、容灾、自动化部署与运营后台

## 5. RPC 与链上查询限制

- 公共 BSC Testnet RPC 可能出现 429 或 `eth_getLogs` 限制
- 大范围历史扫描可能受限，需要选择更稳定的 RPC 或采用分批/重试策略（Phase 2 处理）

## 6. 前端开发态噪音

- 前端仍存在部分既有开发态 warning，例如 Reown Config 403（不在 Phase 1 范围内修复）
- market 页若仍有 `localhost:3001` 旧依赖噪音，需要记录为后续清理项
- 如存在 hydration mismatch 既有问题，需要记录为后续清理项

## 7. 生产运维能力缺失

- 未做生产环境监控、告警、备份、容灾
- 未做生产部署自动化

## 8. 安全与审计

- 未做主网安全审计
- Phase 1 仅作为受控生产可用测试网版本冻结，不代表主网发布门槛已满足
