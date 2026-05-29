# GitHub CLI Automation Reliability

## 1. 背景

Trae Agent 的子进程 shell 与用户交互式终端不是同一个 shell。

因此：

- 用户终端里 `gh auth status` 正常，不代表 Trae Agent subprocess 自动继承 `GH_TOKEN`
- `GITHUB_TOKEN` 为空在本机环境属于正常情况，不应被误判为异常
- 在多数环境中，`source ~/.zshrc` 后可以恢复 `GH_TOKEN` 的可见性
- `gh pr checks --watch` 可能因 GraphQL / checks 权限限制失败，需要 fallback 到 `gh run list` + `gh run watch`

为避免 Stage 2 自动化流程反复卡在认证与 checks 观察阶段，本仓库提供统一脚本与标准流程。

## 2. 标准 Stage 2 开头流程

在任何 `commit / push / create PR / merge` 之前，先执行：

```bash
bash scripts/github/gh-auth-check.sh
```

## 3. 认证判断规则

- `GH_TOKEN` 存在：正常，视为可用于 GitHub CLI 自动化
- `GITHUB_TOKEN` 为空：正常，不是失败
- `GH_TOKEN` 为空但 `GITHUB_TOKEN` 存在：允许临时 `export GH_TOKEN="$GITHUB_TOKEN"`
- `GH_TOKEN` 与 `GITHUB_TOKEN` 都为空，但 `gh auth status` 显示已登录：允许临时 `export GH_TOKEN="$(gh auth token)"`
- 禁止自动启动 browser device code 授权
- 禁止自动执行 `gh auth login`
- 禁止向用户索要 token

## 4. checks fallback

优先尝试：

```bash
gh pr checks <PR_NUMBER> --watch
```

如果因 GraphQL / checks 权限限制失败，使用：

```bash
gh run list --branch <branch> --limit 5
gh run watch <run-id>
```

如果无法确定分支或需要查看最近的 workflow：

```bash
gh run list --limit 5
```

## 5. 安全规则

- 不打印 token
- 不提交 token
- 不提交 `.env`
- 不提交 `.trae/`
- 不写入 shell profile
- 不自动 `gh auth login`

## 6. 后续使用示例

```bash
bash scripts/github/gh-auth-check.sh

git status --short
git add <allowed-files-only>
git commit -m "<message>"
git push -u origin <branch>
gh pr create ...

gh pr checks <PR_NUMBER> --watch || {
  gh run list --branch <branch> --limit 5
}
```
