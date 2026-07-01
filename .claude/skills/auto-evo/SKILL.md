---
name: auto-evo
description: XMarket（Solidity 托管/撮合/结算合约 + Node·TS 后端）C2C 市场区域轮巡式自迭代，经 /auto-evo 触发，默认每 3 小时自动一轮、每轮只聚焦架构蓝图(REGIONS.md)中的一个代码区域、轮巡一圈后循环。当用户要求每日/定期/定时迭代 XMarket 代码、对标合约规范与 API 契约与安全审计做校验、做资金托管安全与越权防护与撮合一致性与性能优化并自动提交时使用。每轮闭环：选区→扫描审计→发现问题→规划修复→执行修复→分层测试→反向审计→验收提交推送；下一轮换下一个区域。绝不广播真实交易、绝不动用真实资金、绝不弱化鉴权/授权、绝不泄露密钥/PII。
---

# auto-evo · XMarket 市场轮巡式自迭代（/auto-evo）

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
经 /auto-evo 启动后定位并读取"事实基线"（缺失则索取，不得脑补）：
- PR 描述/任务卡（目标、验收标准、聚焦层 contracts/backend、链与 fork 区块）
- 合约规范 / Gas 预算 / 安全审计 baseline（Slither/审计报告/已知 issue）、托管与结算状态机定义
- API 契约（OpenAPI/路由清单）、authZ 模型（角色/资源/owner 关系）、DB schema 与迁移、限流与签名/nonce 政策
- 链上↔链下对账口径（事件→账本映射、资金守恒等式）、只读 RPC、已部署合约地址/ABI/版本
随后探测：Node·TS 工程(包管理/构建/测试/lint)、Foundry/Hardhat、unit/集成/越权/不变量/fork/负载入口、CI 命令集、当前分支与工作区是否干净、合约链上版本与代码库 ABI 是否一致、迁移是否前向可回滚。

## 1.1 关键文件契约（记忆与计划的单一真相源）
- 架构蓝图（只读权威）：docs/ARCHITECTURE.md（可 config 覆盖）。定义模块边界、依赖方向与领域不变量。本 skill 只对标、不改。
- PR 规划手册（活文档·计划与状态单一真相源）：docs/PR-PLAYBOOK.md。含 模块清单、每模块 PR 路线图（待办/进行/已完成）、每条 PR 目标与验收标准、关键决策与"上报项"、巡次(sweep)与轮换记录。每轮读、每轮回写。
- 工作记忆：.auto-evo/worklog.md（累积）+ .auto-evo/round-<N>.md（每轮报告）+ 现有 daily-<date>.json（运行态：seed/forkBlock/loadProfile/cursor/roundsDone/lastRoundEndUTC）。
- 职责边界：daily-json 只管运行态计数；PR 手册才是工作记忆与计划的权威，两者不混。

## 2. 硬边界与禁止清单（Boundaries / Non-goals）
- ❌ 违反 R0/R0'：广播交易、部署、动资金、读私钥、弱化鉴权/授权、泄露 secret/PII——绝对禁止。
- ❌ 不在 main/master/release 直接改动或提交；只在 `auto-evo/<UTC日期>` 工作分支作业。
- ❌ 不 force-push、不改写已共享历史、不删他人提交。
- ❌ 不读取/打印/提交任何密钥、助记词、.env、真实用户数据；diff 与日志须经密钥/PII 扫描。
- ❌ 不改本 Skill 自身、.git/、.github/、CI 配置——除非显式授权。
- ❌ 不改：合约 ABI/接口、结算数学与精度/舍入、托管状态机、公共 API 契约(OpenAPI)、DB schema、authZ 模型、撮合不变量——除非显式授权（归"上报项"）。
- ❌ upgradeable 合约不改存储布局；DB 不做破坏性迁移、不删约束/索引。
- ❌ 安全只许增强：不移除重入卫士/CEI、不放宽限流、不扩大权限、不去掉输入校验、不把鉴权改弱。
- ❌ 不新增第三方依赖；确需引入则停下上报。
- ❌ 单轮：Solidity 合约 ≤ 2，Node·TS 文件 ≤ 8，涉及模块 ≤ 2，不跨无关模块。
- ❌ 禁止为过门禁而删/改测试、改预期、标 skip、放宽 slither/semgrep/eslint 配置、降低 fuzz 轮数。

## 3. 区域轮巡机制（Region Rotation）—— 本 Skill 的核心节律
- 节律：默认**每 3 小时自动一轮**（cron `0 */3 * * *`，UTC 00/03/06/09/12/15/18/21 触发）；交互式手动触发亦遵循同一选区规则。
- 一轮一区：**每轮只聚焦一个代码区域**，区域取自架构蓝图 `.claude/skills/auto-evo/REGIONS.md`（权威）。
- 选区算法（确定性、免持久化游标，可在每轮全新会话中复算）：
  · `blockIndex = floor(UTC_epoch_seconds / 10800)`（10800=3h）；`regionIndex = blockIndex mod N`（N=REGIONS 表条目数）。
  · 取 `order == regionIndex` 的区域为本轮唯一聚焦区；逐区前进、每日巡满一圈后从头循环。
  · 落地：`date -u +%s` → `/10800` 取整 → `mod N` → 查 REGIONS 表。
- 区外只读不改：本轮 FileScope 严格限定在所选区域的 glob 内；跨区/跨层契约改动一律归"上报项"（§10），不在本轮自动改。
- 区域级跳过：若所选区当轮无可证收益（连续命中同区 2 次仍无），记 `skippedRegions[]` 并照常前进到下一区，不空转。
- **小轮 vs 大轮**：一个"**小轮**"= 一次触发 = 扫描并处理**一个模块/区域**；一个"**大轮**"（full cycle）= 连续 N 个小轮把 REGIONS 表**全部 N 个模块都轮巡扫描完一遍**（= 整个项目全模块覆盖一圈）。默认 N=8、3h/轮 → 一大轮≈24h。

## 3''. 大轮安全基线（Cycle Baseline）—— 每完成一大轮打一次
- 触发条件：**仅在完成一大轮时**打一次安全基线锚点；单个小轮结束**不打**基线，只做常规提交（§7）。
- 大轮完成判定（确定性、免持久化游标）：
  · `cycleNumber = floor(UTC_epoch_seconds / (10800 * N))`；当本轮 `regionIndex == N-1`（大轮最后一个模块）且其门禁全绿 → 该大轮完成。
  · 等价理解：从 order=0 扫到 order=N-1 走满一圈，即"整个项目所有模块都扫描完"。
- 基线命名与序号：人类可读**顺序号** `baseline-<K+1>`，K = 现存 `baseline-*` 锚点的最大序号（远端 `git ls-remote origin 'refs/heads/baseline-*'` / `refs/tags/baseline-*` 取 max）。当前起点：`baseline-1`。
- 空大轮去重：若本大轮相对上一基线**无新提交**（当前良好 HEAD 的 sha == 最新 baseline 指向的 sha）→ **跳过**，不打重复基线。
- 落地机制（tag 优先，被策略拒则退化为基线分支）：
  · 首选附注标签 `git tag -a baseline-<K+1> -m "…"`；
  · 若推送标签被 git 中继策略 403 拒（本仓即此情况）→ 改用**基线分支**：经 GitHub API/`gh api repos/:owner/:repo/git/refs -f ref=refs/heads/baseline-<K+1> -f sha=<goodSha>` 创建永不写入的只读快照分支，效果等价、远端持久。
- 指向：基线指向"本大轮末轮通过全部门禁、对账平衡"的那个提交（当前工作分支 HEAD 的良好提交）。
- 回滚：`git fetch origin baseline-<K>` 后 `git reset --hard origin/baseline-<K>`（整体回滚）/ `git checkout origin/baseline-<K> -- <path>`（按文件恢复）/ `git switch -c fix-from-baseline origin/baseline-<K>`（从基线另起分支）。
- 记 `lastBaseline`、`lastBaselineCycle`、`lastBaselineSha` 入当日状态，供下一大轮去重比对。

## 3'. 每日复现基线与状态（Daily State）
- 每日 P0 在 .auto-evo/daily-<UTC日期>.json 建/读：pinnedForkBlock、pinnedSeed、loadProfile(rps/conns/dataScale)、roundsDone、roundsCap(默认8=每日巡满一圈)、regionsDone[]、currentRegion、dimsTouched、cumGains、rejected[]、skippedRegions[]、lastCommit、lastGasSnapshotHash。
- pinnedForkBlock + pinnedSeed + loadProfile 当日仅钉一次，全天所有 fork/撮合 fuzz/负载测试复用，保证可复现可比。
- 幂等续跑（同一 3h 区块内重复触发选同区、复用基线，不重复提交）；轮间隔由 cron 保证 ≥3h（≥10 分钟下限自然满足）。
- 职责界定（见 §1.1）：本 daily-json **只管运行态计数**（seed/forkBlock/loadProfile/cursor/roundsDone/lastRoundEndUTC 等）；**工作记忆与计划的权威是 PR 手册 docs/PR-PLAYBOOK.md**，两者不混。

## 3.9 首次冷启动（Bootstrap，仅一次）
若 PR-PLAYBOOK.md 或 config 不存在：
1) 扫描架构蓝图与仓库，产出模块清单（路径、依赖、风险面）。
2) 按本 skill 的盯死优先级 资金/托管安全 > API/越权与数据安全 > 撮合/结算一致性 > 并发/吞吐/延迟（§0 四维目标原文，不新增） 为每模块起草 PR 路线图，写入 PR 手册。
3) 生成 config（modules、cursor=0、domainProfile=xmarket、mergePolicy 默认安全）。
4) 原子提交手册与 config（chore(auto-evo): bootstrap plan & module inventory），停止并输出冷启动摘要，等下一轮正式开工。
已存在则跳过，直接进入每轮流程。

## 4. 单轮工作流（每轮严格 P0→P6，大轮末轮追加 P7；对应用户闭环：选区→扫描审计→发现问题→规划修复→执行修复→分层测试→反向审计→验收提交，大轮末轮再打基线）
T0 连续性回顾（每轮第一件事）：读 PR 手册 + 最近 worklog + 上轮报告 → 恢复"上轮做到哪、下一条 PR 是什么、有哪些未决上报项"，据此确定本轮模块与目标，再进入原有预检/门禁流程。
T-末 同步回写（每轮最后一件事，门禁全绿后）：在 PR 手册标记本条 PR 状态、登记提交/PR 链接与残留风险、更新巡次与 cursor；写本轮报告与 worklog；更新 daily-json 的 cursor/lastRoundEndUTC。
铁律：未完成 T-末 回写不算收官；下一轮 T0 必须能仅从 PR 手册恢复全部计划状态，不依赖重新读代码猜进度。

P0 选区与预检：
  (a) 选区：按 §3 选区算法计算 regionIndex，从 REGIONS.md 取本轮唯一聚焦区与其 FileScope/门禁画像/已知锚点；写 currentRegion。
  (b) 工具链自举（缺则装，按 CI 锁定版，不跳门禁、不弱化）：探测 forge/anvil/cast/slither/semgrep/node 与所选区相关者；缺合约工具→`foundryup --install <CI版本>`（本仓为 1.7.1）；缺 slither→`pip install slither-analyzer`；缺 semgrep→`pip install semgrep`；联网失败或无法装→停并上报，不以臆测替代。
  (c) 每日基线（每日首轮）：只读 RPC ping；启动本地 anvil fork @ pinnedForkBlock；只读 call 校验已部署合约版本与代码库 ABI 一致；DB 测试库就绪、迁移可前向应用并回滚演练通过；钉 pinnedSeed+loadProfile；写状态。
  · 合约类区缺只读 RPC 仅影响 fork 门禁→可降级为 build+unit+invariant/fuzz+slither+snapshot 并在报告标注「fork 跳过(无RPC)」；其余任一失败→全轮停并上报。
P1 对标校验（仅限本轮区域 FileScope）：在所选区域的 glob 内比对代码与合约规范/API 契约/authZ 模型/审计 baseline，输出清单（文件:行号、证据、严重级）：资金隐患(重入/结算非原子/精度舍入/超额释放/对账缺口) + 越权与数据(IDOR/BOLA、缺鉴权、注入、重放、限流缺失、PII 泄露) + 撮合不一致(非幂等、事务破坏、不变量违背、并发竞态) + 性能(N+1、阻塞事件循环、缺索引/缓存)。规范为权威；需改契约则归"上报项"。
P2 审计与更优写法：按四维（资金优先）对每个候选点给"同语义更优实现"（CEI/重入卫士、SafeERC20、结算幂等键、固定点精度、参数化授权检查、owner 校验、限流中间件、nonce 防重放、撮合幂等与乐观锁、批量/缓存消除 N+1、连接池），标收益维度/风险；本轮择优选 1 个收益最高且可证伪目标（同等收益时优先资金/越权类）。
P3 实施：工作分支最小原子改动；保持 ABI/结算数学/API 契约/authZ 模型/撮合不变量等价；同步补 unit + 越权负样本 + 撮合不变量/fuzz + fork + 对账测试。
P4 反向审计（安全官视角）：等价性是否成立？是否引入重入/结算非原子/超额释放？越权负样本是否仍被拒？撮合不变量(资金守恒/无重复成交/幂等)是否保持？链上↔链下对账是否平？日志是否漏 secret/PII？触禁止清单吗？发现问题立即修正或回退。
P5 分层验证（按改动面触发，真实执行留证）：
  · 快门禁（每轮，门控 commit）：见 §5。
  · 重门禁（门控 push，按面）：合约改动→fork test@pinnedBlock + invariant/fuzz + slither + 存储布局校验；后端改动→API 集成 + 越权负样本套件 + 撮合不变量/fuzz@pinnedSeed + 依赖审计 + semgrep + 负载/延迟@loadProfile；跨层→链上↔链下对账测试。
  指标：gas before→after、测试通过率、越权拦截率、撮合不变量结果、对账平衡、p50/p95 延迟与吞吐、安全告警增量、secret/PII 扫描=干净。任一未过/回归→轮内修复；修不了则 git revert，记入 rejected[]。
P6 闭环提交推送：仅当对应门禁全绿且对账平衡时原子提交（CI 环境只 commit，push/PR 交后续步骤；交互式则 push 工作分支）；否则不提交。更新状态。
P7 大轮收尾（仅当本轮 `regionIndex == N-1` 且门禁全绿）：按 §3'' 判定大轮完成 → 若相对上一基线有新提交则打 `baseline-<K+1>`（标签优先，被拒退化为基线分支 via GitHub API/`gh api`），指向本轮良好 HEAD；空大轮跳过。更新 `lastBaseline*`。非大轮末轮不执行本步。

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
- 分支 `auto-evo/<UTC日期>`，起始工作区干净。
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

## 9. 停止条件（单轮级）
任一即停并汇总（仅结束**本轮**，不影响下一个 3h 触发）：① 达 roundsCap(默认8，每日巡满一圈)/用户指定轮数；② 本区连续 2 轮无可证收益→记 skippedRegions[] 并让位下一区；③ 触发需上报的 ABI/结算/API/authZ/schema/存储/依赖 决策；④ fork/越权/不变量/对账出现无法轮内修复阻塞；⑤ RPC 不可达、链上版本与代码库不同步、或迁移回滚失败、或工具链联网安装失败。停止时保证工作区干净、末次提交门禁全绿、对账平衡、状态与日报落盘。

## 10. 多模块与上报项
- 单轮聚焦 REGIONS.md 中**一个**区域；跨区/跨层契约（ABI、事件→账本映射、API、authZ 模型、DB schema）改动归上报项，开 PR 等人工 review。
- 多链部署时本轮指定 fork 链；默认主链最新已部署版本，P0 必须核对链上↔代码库一致。

## 11. 自动轮巡触发器（Automation）
- 默认节律由外部调度器每 3 小时触发一次 `/auto-evo`（cron `0 */3 * * *`，UTC）；每次触发即一轮，按 §3 选区算法自动落到当下 3h 区块对应的区域，逐区前进、每日巡满一圈后循环。
- 触发器与本 Skill 解耦：Skill 不自管调度，仅在被触发时按时钟选区执行单轮闭环。调度可由 claude-code-remote 的 create_trigger（cron）、或仓库 GitHub Action（schedule）承载。
- 调度器变更/暂停/停用属运维操作，不在 Skill 自治范围；Skill 永不自行新建/删除调度。
- 自动轮巡下：纯性能/可读/稳定改进 → 自动提交并 push 工作分支；触上报项 → 仅开 PR 候人工 review，绝不自动合受保护分支（§7/§8 不变）。
- **大轮基线由调度器落地**：GitHub Action 在 `regionIndex == N-1` 且本轮门禁全绿时执行 §3''/§P7——相对上一基线有新提交则创建顺序基线 `baseline-<K+1>`（本仓标签推送被策略拒 → 用 `gh api` 建只读基线分支），空大轮跳过；`baseline-1` 为人工冻结起点。
