#!/bin/bash

# ============================================
# 甲方服务器安全部署脚本
# 关键: 只加载镜像，不构建，甲方看不到源码
# ============================================

set -e

echo "🚀 开始部署 AixL 应用..."
echo "时间: $(date)"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# ============================================
# 第 1 步: 检查前置条件
# ============================================
echo -e "${BLUE}[步骤 1/6] 检查前置条件...${NC}"

if ! command -v docker &> /dev/null; then
  echo -e "${RED}❌ Docker 未安装${NC}"
  exit 1
fi

if ! command -v docker-compose &> /dev/null; then
  echo -e "${RED}❌ Docker Compose 未安装${NC}"
  exit 1
fi

echo -e "${GREEN}✅ Docker 和 Docker Compose 已安装${NC}"

# ============================================
# 第 2 步: 检查必要的文件
# ============================================
echo ""
echo -e "${BLUE}[步骤 2/6] 检查必要文件...${NC}"

REQUIRED_FILES=(
  ".env.production"
  "docker-compose.production.yml"
  "nginx/nginx.conf"
  "docker/aixl-backend.tar.gz"
  "docker/aixl-frontend.tar.gz"
  "docker/aixl-admin.tar.gz"
)

for file in "${REQUIRED_FILES[@]}"; do
  if [ ! -f "$file" ] && [ ! -d "$(dirname $file)" ]; then
    echo -e "${RED}❌ 缺少文件: $file${NC}"
    exit 1
  fi
done

echo -e "${GREEN}✅ 所有必要文件已检查${NC}"

# ============================================
# 第 3 步: 加载 Docker 镜像
# ============================================
echo ""
echo -e "${BLUE}[步骤 3/6] 加载 Docker 镜像...${NC}"

echo "加载后端镜像..."
docker load -i docker/aixl-backend.tar.gz

echo "加载前端镜像..."
docker load -i docker/aixl-frontend.tar.gz

echo "加载管理后台镜像..."
docker load -i docker/aixl-admin.tar.gz

echo -e "${GREEN}✅ 所有镜像已加载${NC}"

# ============================================
# 第 4 步: 验证镜像
# ============================================
echo ""
echo -e "${BLUE}[步骤 4/6] 验证镜像...${NC}"

if docker image inspect aixl/backend:latest > /dev/null 2>&1; then
  echo -e "${GREEN}✅ 后端镜像已加载${NC}"
else
  echo -e "${RED}❌ 后端镜像加载失败${NC}"
  exit 1
fi

if docker image inspect aixl/frontend:latest > /dev/null 2>&1; then
  echo -e "${GREEN}✅ 前端镜像已加载${NC}"
else
  echo -e "${RED}❌ 前端镜像加载失败${NC}"
  exit 1
fi

if docker image inspect aixl/admin:latest > /dev/null 2>&1; then
  echo -e "${GREEN}✅ 管理后台镜像已加载${NC}"
else
  echo -e "${RED}❌ 管理后台镜像加载失败${NC}"
  exit 1
fi

# ============================================
# 第 5 步: 启动服务
# ============================================
echo ""
echo -e "${BLUE}[步骤 5/6] 启动服务...${NC}"

echo "停止旧容器 (如果存在)..."
docker-compose -f docker-compose.production.yml down 2>/dev/null || true

echo "启动服务..."
docker-compose -f docker-compose.production.yml up -d

echo "等待服务启动..."
sleep 10

# ============================================
# 第 6 步: 验证部署
# ============================================
echo ""
echo -e "${BLUE}[步骤 6/6] 验证部署...${NC}"

echo "检查容器状态..."
RUNNING=$(docker-compose -f docker-compose.production.yml ps -q | wc -l)

if [ "$RUNNING" -eq 6 ]; then
  echo -e "${GREEN}✅ 所有 6 个容器正在运行${NC}"
else
  echo -e "${YELLOW}⚠️  只有 $RUNNING 个容器运行 (预期 6 个)${NC}"
fi

# 显示容器状态
echo ""
echo -e "${BLUE}容器状态:${NC}"
docker-compose -f docker-compose.production.yml ps

# 检查后端健康状态
echo ""
echo -e "${BLUE}检查后端健康状态...${NC}"
if curl -f http://localhost:3001/health > /dev/null 2>&1; then
  echo -e "${GREEN}✅ 后端正常运行${NC}"
else
  echo -e "${YELLOW}⚠️  后端仍在启动中，稍等片刻...${NC}"
fi

# 检查 License 验证
echo ""
echo -e "${BLUE}检查 License 验证...${NC}"
sleep 5
if docker-compose -f docker-compose.production.yml logs backend | grep -i "License validation successful" > /dev/null; then
  echo -e "${GREEN}✅ License 验证成功${NC}"
else
  echo -e "${YELLOW}⚠️  License 验证检查中...${NC}"
fi

# ============================================
# 部署完成
# ============================================
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ 部署完成！                              ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"

echo ""
echo -e "${BLUE}访问地址:${NC}"
echo "  前端应用:    http://localhost:3000"
echo "  管理后台:    http://localhost:3002"
echo "  后端 API:    http://localhost:3001"
echo "  API 文档:    http://localhost:3001/api"
echo ""

echo -e "${BLUE}查看日志:${NC}"
echo "  所有服务:    docker-compose -f docker-compose.production.yml logs"
echo "  后端:        docker-compose -f docker-compose.production.yml logs backend"
echo "  前端:        docker-compose -f docker-compose.production.yml logs frontend"
echo "  数据库:      docker-compose -f docker-compose.production.yml logs postgres"
echo ""

echo -e "${BLUE}常用命令:${NC}"
echo "  停止服务:    docker-compose -f docker-compose.production.yml down"
echo "  重启服务:    docker-compose -f docker-compose.production.yml restart"
echo "  查看容器:    docker ps"
echo ""

echo -e "${YELLOW}⚠️  安全提醒:${NC}"
echo "  • 源码已被编译成容器镜像，甲方无法看到源码"
echo "  • 修改 .env.production 中的所有敏感密码"
echo "  • 配置 HTTPS/SSL 证书"
echo "  • 定期备份数据库"
echo "  • 监控容器运行状态和日志"
echo ""

echo -e "${GREEN}部署流程已完成！${NC}"
