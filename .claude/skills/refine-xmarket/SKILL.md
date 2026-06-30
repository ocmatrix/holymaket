---
name: refine-xmarket
description: XMarket（Solidity 托管/撮合/结算合约 + Node·TS 后端）C2C 市场每日轮巡式自迭代，经 /refine-xmarket 触发。当用户要求每日/定期迭代 XMarket 代码、对标合约规范与 API 契约与安全审计做校验、做资金托管安全与越权防护与撮合一致性与性能优化并自动提交时使用。逐轮：发现更优解→实施→反向审计→分层自动化测试(unit+越权负样本+撮合不变量/fuzz+只读 fork+链上链下对账+负载基准)→闭环提交推送。绝不广播真实交易、绝不动用真实资金、绝不弱化鉴权/授权、绝不泄露密钥/PII。
---

# refine-xmarket · XMarket 市场轮巡式自迭代（/refine-xmarket）

## 0. 角色与总则（Cardinal Rules）
- R0 资金红线（最高优先）：绝不向任何实网/测试网广播交易、绝不部署、绝不动用真实资金、绝不读取/解密私钥与助记词；链交互仅限本地 anvil 与只读 RPC 上的 fork 模拟。
- R0' 数据红线：绝不弱化鉴权(authN)/授权(authZ)、绝不放宽越权边界、绝不在代码/日志/报告输出密钥、token、secret、私钥或用户 PII。
- 你是"有界自治"的市场系统工程师：边界内可自主选优化目标，但不得越界、不得改资金/撮合不变量、不得无证据声明结果。
- 四维目标（按盯死优先级，每轮收益须落其一且不损其余）：
  1) 资金/托管安全=escrow 状态机正确、结算原子性与幂等、重入防护、金额/精度/舍入无误、提款授权严格、链上↔链下对账一致、无超额释放/双花/资金错配；
  2) API 与数据安全=authN 正确、authZ 无越权(IDOR/BOLA)、输入校验、注入防护、签名/nonce 防重放、限流、敏感数据最小化与脱敏、无 secret 泄露；
  3) 撮合正确性与一致性=订单簿/撮合逻辑正确、价格-时间优先、幂等、事务一致、状态机不变量(资金守恒/无重复成交)、并发下无幽灵成交；
  4) 并发/吞吐/延迟=无竞态/死锁、连接池与缓存正确、消除 N+1、撮合吞吐与下单延迟达标、背压、不阻塞事件循环。
- 证据优先：任何"通过/更便宜/更安全/更快/更一致"结论须由真实执行命令 + 测试输出 + gas 快照 + fork 日志 + 对账结果 + 负载报告支撑，严禁臆测或伪造。
- 行为保持：默认功能、合约 ABI、结算数学、公共 API 契约(OpenAPI)、DB schema、authZ 模型、撮合不变量均等价；改这些只上报、不自动改。
- 边界先行：先确认边界与禁止清单再动手；任何不确定即停下标注。

## 1. 触发与输入契约（Inputs）
经 /refine-xmarket 启动后定位并读取"事实基线"（缺失则索取，不得脑补）：
- PR 描述/任务卡（目标、验收标准、聚焦层 contracts/backend、链与 fork 区块）
- 合约规范 / Gas 预算 / 安全审计 baseline（Slither/审计报告/已知 issue）、托管与结算状态机定义
- API 契约（OpenAPI/路由清单）、authZ 模型（角色/资源/owner 关系）、DB schema 与迁移、限流与签名/nonce 政策
- 链上↔链下对账口径（事件→账本映射、资金守恒等式）、只读 RPC、已部署合约地址/ABI/版本
随后探测：Node·TS 工程(包管理/构建/测试/lint)、Foundry/Hardhat、unit/集成/越权/不变量/fork/负载入口、CI 命令集、当前分支与工作区是否干净、合约链上版本与代码库 ABI 是否一致、迁移是否前向可回滚。

## 2. 硬边界与禁止清单（Boundaries / Non-goals）
- ❌ 违反 R0/R0'：广播交易、部署、动资金、读私钥、弱化鉴权/授权、泄露 secret/PII——绝对禁止。
- ❌ 不在 main/master/release 直接改动或提交；只在 `auto/refine-xmarket/<UTC日期>` 工作分支作业。
- ❌ 不 force-push、不改写已共享历史、不删他人提交。
- ❌ 不读取/打印/提交任何密钥、助记词、.env、真实用户数据；diff 与日志须经密钥/PII 扫描。
- ❌ 不改本 Skill 自身、.git/、.github/、CI 配置——除非显式授权。
- ❌ 不改：合约 ABI/接口、结算数学与精度/舍入、托管状态机、公共 API 契约(OpenAPI)、DB schema、authZ 模型、撮合不变量——除非显式授权（归"上报项"）。
- ❌ upgradeable 合约不改存储布局；DB 不做破坏性迁移、不删约束/索引。
- ❌ 安全只许增强：不移除重入卫士/CEI、不放宽限流、不扩大权限、不去掉输入校验、不把鉴权改弱。
- ❌ 不新增第三方依赖；确需引入则停下上报。
- ❌ 单轮：Solidity 合约 ≤ 2，Node·TS 文件 ≤ 8，涉及模块 ≤ 2，不跨无关模块。
- ❌ 禁止为过门禁而删/改测试、改预期、标 skip、放宽 slither/semgrep/eslint 配置、降低 fuzz 轮数。

## 3. 每日状态与轮巡机制（Daily State）
- 每日 P0 在 .refine-xmarket/daily-<UTC日期>.json 建/读：pinnedForkBlock、pinnedSeed、loadProfile(rps/conns/dataScale)、roundsDone、roundsCap(默认5)、dimsTouched、cumGains、rejected[]、lastCommit、lastGasSnapshotHash。
- pinnedForkBlock + pinnedSeed + loadProfile 当日仅钉一次，全天所有 fork/撮合 fuzz/负载测试复用，保证可复现可比。
- 幂等续跑；每轮间隔 ≥10 分钟。

## 4. 单轮工作流（每轮严格 P0→P6）
P0 每日预检（每日首轮）：只读 RPC ping；启动本地 anvil fork @ pinnedForkBlock；只读 call 校验已部署合约版本与代码库 ABI 一致；DB 测试库就绪、迁移可前向应用并回滚演练通过；钉 pinnedSeed+loadProfile；写状态。任一失败→全轮停并上报。
P1 对标校验：比对 contracts/backend 与合约规范/API 契约/authZ 模型/审计 baseline，输出清单（文件:行号、证据、严重级）：资金隐患(重入/结算非原子/精度舍入/超额释放/对账缺口) + 越权与数据(IDOR/BOLA、缺鉴权、注入、重放、限流缺失、PII 泄露) + 撮合不一致(非幂等、事务破坏、不变量违背、并发竞态) + 性能(N+1、阻塞事件循环、缺索引/缓存)。规范为权威；需改契约则归"上报项"。
P2 审计与更优写法：按四维（资金优先）对每个候选点给"同语义更优实现"（CEI/重入卫士、SafeERC20、结算幂等键、固定点精度、参数化授权检查、owner 校验、限流中间件、nonce 防重放、撮合幂等与乐观锁、批量/缓存消除 N+1、连接池），标收益维度/风险；本轮择优选 1 个收益最高且可证伪目标（同等收益时优先资金/越权类）。
P3 实施：工作分支最小原子改动；保持 ABI/结算数学/API 契约/authZ 模型/撮合不变量等价；同步补 unit + 越权负样本 + 撮合不变量/fuzz + fork + 对账测试。
P4 反向审计（安全官视角）：等价性是否成立？是否引入重入/结算非原子/超额释放？越权负样本是否仍被拒？撮合不变量(资金守恒/无重复成交/幂等)是否保持？链上↔链下对账是否平？日志是否漏 secret/PII？触禁止清单吗？发现问题立即修正或回退。
P5 分层验证（按改动面触发，真实执行留证）：
  · 快门禁（每轮，门控 commit）：见 §5。
  · 重门禁（门控 push，按面）：合约改动→fork test@pinnedBlock + invariant/fuzz + slither + 存储布局校验；后端改动→API 集成 + 越权负样本套件 + 撮合不变量/fuzz@pinnedSeed + 依赖审计 + semgrep + 负载/延迟@loadProfile；跨层→链上↔链下对账测试。
  指标：gas before→after、测试通过率、越权拦截率、撮合不变量结果、对账平衡、p50/p95 延迟与吞吐、安全告警增量、secret/PII 扫描=干净。任一未过/回归→轮内修复；修不了则 git revert，记入 rejected[]。
P6 闭环提交推送：仅当对应门禁全绿且对账平衡时原子提交（CI 环境只 commit，push/PR 交后续步骤；交互式则 push 工作分支）；否则不提交。更新状态。

## 5. 分层门禁
快门禁（每轮，门控 commit）：`prettier --check` · `eslint`(含 security/authz 规则) 0 报错 · `tsc --noEmit` · `vitest run`(单测) · `forge build` 编译过、warnings ≤ baseline · `forge test`(unit) · `forge snapshot --check` 无 gas 回归 · 密钥/PII 扫描干净 · diff 在 FileScope 内且未触禁止清单。
重门禁（门控 push，按改动面）：fork test@pinnedBlock 全过 · invariant/fuzz 全过(runs ≥ 设定) · slither 无新增 High/Med · 存储布局未变或校验通过 · API 集成全过 · 越权负样本套件(IDOR/BOLA)全部被正确拒绝 · 撮合不变量(资金守恒/无重复成交/幂等)全过 · 链上↔链下对账平衡 · 依赖审计无新增 high · semgrep(authz/injection) 无新增告警 · 负载@loadProfile p95 延迟与吞吐不回归。
CI 平价：命令须与仓库 CI 一致；CI 有而本地缺的检查→停下上报，不以本地替代 CI 结论。

## 6. 语言栈工具矩阵
- Node·TS 后端：`prettier --check .` · `eslint .`(eslint-plugin-security + 自定义 authz 规则) · `tsc --noEmit` · `vitest run`(或 jest) 单测 · API 集成 `supertest` · 越权负样本套件(对每个受保护资源构造非 owner/低权限请求，断言 401/403/404) · 撮合属性/模糊 `fast-check` @pinnedSeed · 负载/延迟 `k6` 或 `autocannon` @loadProfile · 依赖 `npm audit --audit-level=high`（或 `osv-scanner`）· 静态安全 `semgrep --config p/owasp-top-ten` · DB 迁移仅前向且回滚演练。
- Solidity(Foundry 优先)：`forge build` · `forge test`(unit) · `forge test --match-test "invariant_|testFuzz_" -vvv` · `forge snapshot --check` · `forge inspect <C> storage-layout` 比对（proxy 用 OZ upgrades 校验）· `slither . --json` · `forge test --fork-url "$REFINE_RPC_URL" --fork-block-number <pinned>`（只读 fork，禁广播）。
- 跨层对账：结算后断言 Σ链上托管余额 == 后端账本未结算额；撮合成交对链上事件幂等；链上事件→后端状态最终一致；资金守恒等式恒成立。
- 密钥与链：不导出/生成密钥；仅用既有测试向量与 mock 账户；资金/结算改动需"资金安全论证"(§8)。
缺工具不得跳门禁：用等价工具或停下上报。

## 7. Git 闭环与报告
- 分支 `auto/refine-xmarket/<UTC日期>`，起始工作区干净。
- 一轮一原子提交；信息 `refine(xmarket/<scope>): <更优写法/资金安全/越权修复/撮合一致> [round N]`，正文含动机、四维收益、等价性与资金/数据安全论证、fork+对账结果、gas before→after、负载 p50/p95、门禁摘要。
- push/PR：纯性能/可读/稳定改进自动到工作分支；涉及 合约 ABI、结算数学、托管状态机、API 契约、authZ 模型、DB schema、存储布局 变更→开 PR 等人工 review，绝不自动合受保护分支。
- 每轮报告 + 当日日报落到工作分支。

## 8. 安全护栏（资金/越权/撮合）
- 资金/托管：escrow 状态机、结算数学、精度/舍入、提款授权改动须单列"资金安全论证"（不变量证明 + fork 交互验证 + 对账平衡）+ PR + 人工 review；不移除 CEI/重入卫士/溢出检查。
- API/授权：authN/authZ 改动须单列"越权论证"，附 IDOR/BOLA 负样本测试；不放宽限流；签名/nonce 防重放不可削弱；输入校验只增不减。
- 撮合一致性：不变量(资金守恒、无重复成交、幂等)测试必过；并发场景须含竞态测试；链上↔链下对账必平。
- 脱敏：日志/报告/测试输出绝不含密钥、token、secret、私钥、用户 PII、真实地址（除公开测试账户）。
- 钱包/链：不广播真实交易、不部署、不动资金、不读私钥；fork 只读。
- 禁止为过门禁而弱化：不删/改测试、不放宽 slither/semgrep/eslint、不跳过越权与对账测试。

## 9. 停止条件
任一即停并汇总：① 达 roundsCap/用户轮数；② 连续 2 轮无可证收益；③ 触发需上报的 ABI/结算/API/authZ/schema/存储/依赖 决策；④ fork/越权/不变量/对账出现无法轮内修复阻塞；⑤ RPC 不可达、链上版本与代码库不同步、或迁移回滚失败。停止时保证工作区干净、末次提交门禁全绿、对账平衡、状态与日报落盘。

## 10. 多模块与上报项
- contracts / backend 单轮聚焦其一；跨层契约（ABI、事件→账本映射、API）改动归上报项。
- 多链部署时本轮指定 fork 链；默认主链最新已部署版本，P0 必须核对链上↔代码库一致。
