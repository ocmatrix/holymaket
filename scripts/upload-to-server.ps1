#!/usr/bin/env pwsh

# ============================================
# AixL 源码上传脚本 - 上传到授权服务器
# 在本地电脑运行: powershell -ExecutionPolicy Bypass -File upload-to-server.ps1
# ============================================

$ErrorActionPreference = "Stop"

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   AixL 源码上传到授权服务器 (43.157.56.23)          ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green

$SERVER_IP = "43.157.56.23"
$SERVER_PATH = "/opt/AixL"
$LOCAL_PATH = "D:\AixL"

# ============================================
# 第 1 步: 检查本地源码
# ============================================
Write-Host "`n[步骤 1/3] 检查本地源码..." -ForegroundColor Blue

if (Test-Path $LOCAL_PATH) {
    Write-Host "✅ 本地源码存在: $LOCAL_PATH" -ForegroundColor Green
    
    $sourceSize = (Get-ChildItem -Path $LOCAL_PATH -Recurse | Measure-Object -Property Length -Sum).Sum / 1GB
    Write-Host "   大小: $([math]::Round($sourceSize, 2)) GB" -ForegroundColor Cyan
} else {
    Write-Host "❌ 本地源码不存在: $LOCAL_PATH" -ForegroundColor Red
    exit 1
}

# ============================================
# 第 2 步: 测试 SSH 连接
# ============================================
Write-Host "`n[步骤 2/3] 测试 SSH 连接到 $SERVER_IP..." -ForegroundColor Blue

try {
    $testConnection = ssh -o ConnectTimeout=5 -o BatchMode=yes root@$SERVER_IP "echo 'SSH连接成功'" 2>&1
    if ($testConnection -like "*SSH连接成功*" -or $LASTEXITCODE -eq 0) {
        Write-Host "✅ SSH 连接成功" -ForegroundColor Green
    } else {
        Write-Host "⚠️  SSH 可能需要密码验证" -ForegroundColor Yellow
    }
} catch {
    Write-Host "⚠️  无法连接到 $SERVER_IP，请确保网络和 SSH 密钥已配置" -ForegroundColor Yellow
}

# ============================================
# 第 3 步: 上传源码
# ============================================
Write-Host "`n[步骤 3/3] 上传源码到服务器..." -ForegroundColor Blue

# 创建远程目录
Write-Host "创建远程目录: $SERVER_PATH" -ForegroundColor Cyan
ssh root@$SERVER_IP "mkdir -p $SERVER_PATH" 2>&1 | Out-Null

# 上传文件
Write-Host "开始上传文件..." -ForegroundColor Cyan
$startTime = Get-Date

# 显示进度
Write-Host ""
scp -r "$LOCAL_PATH\*" "root@${SERVER_IP}:${SERVER_PATH}/" 2>&1

$endTime = Get-Date
$duration = ($endTime - $startTime).TotalSeconds

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ 上传完成 (耗时: $([math]::Round($duration, 2)) 秒)" -ForegroundColor Green
} else {
    Write-Host "❌ 上传失败" -ForegroundColor Red
    exit 1
}

# ============================================
# 验证上传
# ============================================
Write-Host "`n验证上传结果..." -ForegroundColor Blue

Write-Host "检查远程目录结构:" -ForegroundColor Cyan
ssh root@$SERVER_IP "ls -la $SERVER_PATH" 2>&1 | Select-String -Pattern "^d|package.json|Dockerfile|scripts"

Write-Host "`n检查构建脚本:" -ForegroundColor Cyan
ssh root@$SERVER_IP "test -f $SERVER_PATH/scripts/build-on-server.sh && echo '✅ 构建脚本存在' || echo '❌ 构建脚本不存在'" 2>&1

# ============================================
# 下一步提示
# ============================================
Write-Host "`n╔════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║           ✅ 上传完成！                               ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Green

Write-Host "`n下一步：在授权服务器上构建镜像" -ForegroundColor Yellow
Write-Host "`n运行以下命令:" -ForegroundColor Cyan
Write-Host ""
Write-Host "ssh root@$SERVER_IP" -ForegroundColor White
Write-Host "cd $SERVER_PATH" -ForegroundColor White
Write-Host "bash scripts/build-on-server.sh" -ForegroundColor White
Write-Host ""

Write-Host "预计时间:" -ForegroundColor Yellow
Write-Host "  • 构建镜像: 10-30 分钟" -ForegroundColor Cyan
Write-Host "  • 上传到甲方: 5-15 分钟" -ForegroundColor Cyan
Write-Host "  • 甲方部署: 10-15 分钟" -ForegroundColor Cyan
Write-Host ""

Write-Host "详细说明请查看:" -ForegroundColor Yellow
Write-Host "  📖 LICENSE_SERVER_READY_DEPLOYMENT.md" -ForegroundColor Cyan
