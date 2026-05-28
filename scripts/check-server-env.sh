#!/bin/bash

# ============================================
# 授权服务器环境检查脚本
# 在您的授权服务器上运行: bash check-env.sh
# ============================================

echo "╔════════════════════════════════════════════════════════╗"
echo "║   授权服务器 (43.157.56.23) 环境检查                  ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""

# ============================================
# 系统信息
# ============================================
echo "📊 [系统信息]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "操作系统:"
uname -a

echo ""
echo "主机名:"
hostname

echo ""
echo "当前时间:"
date

# ============================================
# 硬件信息
# ============================================
echo ""
echo "📈 [硬件信息]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "CPU 信息:"
nproc --all
echo "CPU cores: $(nproc --all)"

echo ""
echo "内存信息:"
free -h | head -2

echo ""
echo "磁盘空间:"
df -h | grep -E "^/dev|^Filesystem"

echo ""
echo "磁盘使用 (详细):"
du -sh /* 2>/dev/null | sort -h

# ============================================
# Docker 信息
# ============================================
echo ""
echo "🐳 [Docker 环境]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v docker &> /dev/null; then
    echo "Docker 版本:"
    docker --version
    
    echo ""
    echo "Docker Daemon 状态:"
    if docker ps &> /dev/null; then
        echo "✅ 正在运行"
    else
        echo "❌ 未运行"
        exit 1
    fi
    
    echo ""
    echo "已安装的镜像:"
    docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}"
    
    echo ""
    echo "运行中的容器:"
    docker ps --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
    
    if [ $(docker ps -q | wc -l) -eq 0 ]; then
        echo "（无运行中的容器）"
    fi
    
    echo ""
    echo "所有容器 (包括已停止的):"
    docker ps -a --format "table {{.Names}}\t{{.Image}}\t{{.Status}}"
    
else
    echo "❌ Docker 未安装"
fi

# ============================================
# License Server 检查
# ============================================
echo ""
echo "🔐 [License Server]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "/app/license-server" ]; then
    echo "✅ License Server 目录存在: /app/license-server"
    echo ""
    echo "目录内容:"
    ls -la /app/license-server/ 2>/dev/null | head -20
else
    echo "❌ License Server 目录不存在"
fi

echo ""
echo "License Server 容器状态:"
docker ps -a | grep -i license || echo "（未找到 license 容器）"

echo ""
echo "License Server 端口检查:"
if netstat -tlnp 2>/dev/null | grep 4000; then
    echo "✅ 端口 4000 监听中"
else
    echo "❌ 端口 4000 未监听"
fi

# ============================================
# 源码检查
# ============================================
echo ""
echo "📁 [源码目录]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ -d "/opt/aixl" ]; then
    echo "✅ 源码目录存在: /opt/aixl"
    echo ""
    echo "目录大小:"
    du -sh /opt/aixl
    
    echo ""
    echo "目录结构:"
    ls -la /opt/aixl/ | head -20
    
    if [ -f "/opt/aixl/package.json" ]; then
        echo ""
        echo "✅ package.json 存在"
        echo "版本信息:"
        grep '"name"\|"version"' /opt/aixl/package.json | head -2
    fi
else
    echo "❌ 源码目录不存在: /opt/aixl"
fi

# ============================================
# Node.js 和 npm
# ============================================
echo ""
echo "⚙️  [Node.js 环境]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v node &> /dev/null; then
    echo "Node.js 版本:"
    node --version
    
    echo ""
    echo "npm 版本:"
    npm --version
else
    echo "❌ Node.js 未安装"
fi

# ============================================
# 网络检查
# ============================================
echo ""
echo "🌐 [网络信息]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "IP 地址:"
ip addr show | grep -E "inet " | grep -v "127.0.0.1"

echo ""
echo "开放的端口:"
netstat -tlnp 2>/dev/null | grep LISTEN | awk '{print $4, $7}' || ss -tlnp 2>/dev/null | grep LISTEN

# ============================================
# 进程检查
# ============================================
echo ""
echo "⚙️  [重要进程]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "Docker 进程:"
ps aux | grep "docker" | grep -v grep || echo "（无）"

echo ""
echo "Node 进程:"
ps aux | grep "node" | grep -v grep || echo "（无）"

echo ""
echo "PostgreSQL 进程:"
ps aux | grep "postgres" | grep -v grep || echo "（无）"

# ============================================
# Git 信息
# ============================================
echo ""
echo "📚 [Git 信息]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if command -v git &> /dev/null; then
    echo "Git 版本:"
    git --version
    
    if [ -d "/opt/aixl/.git" ]; then
        echo ""
        echo "✅ Git 仓库存在"
        cd /opt/aixl
        echo ""
        echo "当前分支:"
        git branch -v | head -5
        
        echo ""
        echo "最后一次提交:"
        git log -1 --oneline
    fi
else
    echo "❌ Git 未安装"
fi

# ============================================
# 系统日志
# ============================================
echo ""
echo "📋 [最近系统日志]"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo "最后 5 条 Docker 日志:"
journalctl -u docker --no-pager -n 5 2>/dev/null || echo "（无日志）"

# ============================================
# 总结
# ============================================
echo ""
echo "╔════════════════════════════════════════════════════════╗"
echo "║              环境检查完成                              ║"
echo "╚════════════════════════════════════════════════════════╝"
echo ""
echo "✅ 检查项完成"
echo ""
echo "下一步:"
echo "1. 如果源码不存在，请上传或克隆源码到 /opt/aixl"
echo "2. 如果 Docker 未运行，请启动 Docker"
echo "3. 运行: bash /opt/aixl/scripts/build-on-server.sh"
echo ""
