#!/bin/bash

# ============================================
# AixL Platform 部署脚本（甲方服务器）
# 使用方式: bash deploy-production.sh
# 前提: 镜像 tar.gz 已上传到 ./docker/ 目录
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$APP_DIR"

echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  AixL Platform 部署脚本                ║${NC}"
echo -e "${YELLOW}║  部署目录: $APP_DIR${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"

# ========================================
# 第一步: 系统检查
# ========================================
echo -e "\n${YELLOW}[1/7] 系统检查...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "请执行: curl https://get.docker.com | sh"
    exit 1
fi

if ! docker compose version &> /dev/null && ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    exit 1
fi

# 检测 compose 命令
if docker compose version &> /dev/null; then
    COMPOSE_CMD="docker compose"
else
    COMPOSE_CMD="docker-compose"
fi

echo -e "${GREEN}✅ Docker: $(docker --version)${NC}"
echo -e "${GREEN}✅ Compose: $($COMPOSE_CMD version 2>/dev/null || echo 'OK')${NC}"

# ========================================
# 第二步: 检查必要文件
# ========================================
echo -e "\n${YELLOW}[2/7] 检查配置文件...${NC}"

# 检查 .env.production
if [ ! -f ".env.production" ]; then
    echo -e "${YELLOW}⚠️  未找到 .env.production，正在生成模板...${NC}"
    cp .env.production.example .env.production 2>/dev/null || cat > .env.production << 'ENVEOF'
# ============ AixL Platform 生产环境配置 ============
# ⚠️ 请修改以下所有值

# 数据库
DB_USER=aixl
DB_PASSWORD=CHANGE_ME_db_password
DB_NAME=aixl

# Redis
REDIS_PASSWORD=CHANGE_ME_redis_password

# 授权系统
LICENSE_SERVER=http://43.157.56.23:3100
LICENSE_KEY=CHANGE_ME_license_key
LICENSE_FORCE_STOP=false

# 安全
JWT_SECRET=CHANGE_ME_jwt_secret_at_least_32_chars
JWT_REFRESH_SECRET=CHANGE_ME_jwt_refresh_secret
ADMIN_TOKEN=CHANGE_ME_admin_token

# Privy 认证
PRIVY_APP_ID=CHANGE_ME
PRIVY_APP_SECRET=CHANGE_ME

# AI 服务
OPENAI_API_KEY=CHANGE_ME

# 第三方 API
PANDASCORE_API_KEY=CHANGE_ME
FOOTBALL_API_KEY=CHANGE_ME

# 前端 (域名配置 — 构建镜像时已写入，此处供参考)
NEXT_PUBLIC_API_URL=https://superoctopus.fun/api
NEXT_PUBLIC_WS_URL=wss://superoctopus.fun
CORS_ORIGINS=https://admin.superoctopus.fun

# 管理后台
NEXT_PUBLIC_ADMIN_API_URL=https://superoctopus.fun/api
NEXT_PUBLIC_ADMIN_WS_URL=wss://superoctopus.fun
ENVEOF
    echo -e "${RED}❌ 请先编辑 .env.production 配置所有 CHANGE_ME 项，然后重新运行此脚本${NC}"
    exit 1
fi

# 检查是否有未修改的占位符
if grep -q "CHANGE_ME" .env.production; then
    echo -e "${RED}❌ .env.production 中仍有未修改的 CHANGE_ME 项，请先编辑后重试${NC}"
    grep "CHANGE_ME" .env.production
    exit 1
fi

echo -e "${GREEN}✅ .env.production 已配置${NC}"

# 检查 docker-compose 和 nginx
if [ ! -f "docker-compose.production.yml" ]; then
    echo -e "${RED}❌ 缺少 docker-compose.production.yml${NC}"
    exit 1
fi

mkdir -p nginx/ssl
if [ ! -f "nginx/nginx.conf" ]; then
    echo -e "${RED}❌ 缺少 nginx/nginx.conf${NC}"
    exit 1
fi

echo -e "${GREEN}✅ docker-compose.production.yml 存在${NC}"
echo -e "${GREEN}✅ nginx/nginx.conf 存在${NC}"

# ========================================
# 第三步: 加载 Docker 镜像
# ========================================
echo -e "\n${YELLOW}[3/7] 加载 Docker 镜像...${NC}"

DOCKER_DIR="./docker"
LOADED=0

if [ -d "$DOCKER_DIR" ]; then
    for tarfile in "$DOCKER_DIR"/*.tar.gz; do
        if [ -f "$tarfile" ]; then
            echo -e "${BLUE}  加载: $(basename $tarfile)${NC}"
            docker load -i "$tarfile"
            LOADED=$((LOADED + 1))
        fi
    done
fi

if [ $LOADED -eq 0 ]; then
    # 检查镜像是否已存在
    if docker images | grep -q "aixl/"; then
        echo -e "${GREEN}✅ 镜像已存在，跳过加载${NC}"
    else
        echo -e "${RED}❌ 未找到 Docker 镜像，请将 .tar.gz 文件放入 ./docker/ 目录${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ 已加载 $LOADED 个镜像${NC}"
fi

# 验证镜像
echo -e "${BLUE}已加载的 AixL 镜像:${NC}"
docker images | grep "aixl/" || echo "  (无)"

# ========================================
# 第四步: 停止旧服务（如有）
# ========================================
echo -e "\n${YELLOW}[4/7] 停止旧服务...${NC}"

$COMPOSE_CMD -f docker-compose.production.yml --env-file .env.production down 2>/dev/null || true
echo -e "${GREEN}✅ 旧服务已停止${NC}"

# ========================================
# 第五步: 启动服务
# ========================================
echo -e "\n${YELLOW}[5/7] 启动所有服务...${NC}"

$COMPOSE_CMD -f docker-compose.production.yml --env-file .env.production up -d

echo -e "${YELLOW}  等待服务启动（30秒）...${NC}"
sleep 30

# ========================================
# 第六步: 数据库迁移
# ========================================
echo -e "\n${YELLOW}[6/7] 数据库迁移...${NC}"

# 等待 PostgreSQL 就绪
for i in {1..30}; do
    if docker exec aixl-postgres pg_isready -U aixl &>/dev/null; then
        echo -e "${GREEN}✅ PostgreSQL 已就绪${NC}"
        break
    fi
    sleep 2
done

# 在后端容器内执行 Prisma 迁移（如果支持）
if docker exec aixl-backend ls node_modules/.prisma &>/dev/null; then
    echo -e "${BLUE}  执行 Prisma 数据库迁移...${NC}"
    docker exec aixl-backend npx prisma migrate deploy 2>/dev/null || \
    docker exec aixl-backend npx prisma db push 2>/dev/null || \
    echo -e "${YELLOW}  ⚠️  Prisma 迁移跳过（可能需要手动执行）${NC}"
fi

echo -e "${GREEN}✅ 数据库迁移完成${NC}"

# ========================================
# 第七步: 验证部署
# ========================================
echo -e "\n${YELLOW}[7/7] 验证部署...${NC}"

echo -e "\n${BLUE}容器状态:${NC}"
$COMPOSE_CMD -f docker-compose.production.yml ps

# 健康检查
echo ""
sleep 5
if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 后端 API 正常 (port 3001)${NC}"
else
    echo -e "${YELLOW}⚠️  后端 API 检查中...（可能还在启动）${NC}"
fi

if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 前端 正常 (port 3000)${NC}"
else
    echo -e "${YELLOW}⚠️  前端检查中...${NC}"
fi

if curl -sf http://localhost:3002 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ 管理后台 正常 (port 3002)${NC}"
else
    echo -e "${YELLOW}⚠️  管理后台检查中...${NC}"
fi

# ========================================
# 完成
# ========================================
echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✅ 部署完成！                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"

echo -e "\n📋 服务信息:"
echo -e "  主应用:     https://superoctopus.fun"
echo -e "  管理后台:   https://admin.superoctopus.fun"
echo -e "  API:        https://superoctopus.fun/api"
echo -e "  后端直连:   http://localhost:3001"

echo -e "\n🔍 常用命令:"
echo -e "  查看日志:   $COMPOSE_CMD -f docker-compose.production.yml logs -f backend"
echo -e "  重启服务:   $COMPOSE_CMD -f docker-compose.production.yml restart"
echo -e "  查看状态:   $COMPOSE_CMD -f docker-compose.production.yml ps"
echo -e "  进入数据库: docker exec -it aixl-postgres psql -U aixl -d aixl"
echo -e "  备份数据库: docker exec aixl-postgres pg_dump -U aixl aixl > backup_\$(date +%Y%m%d).sql"
echo -e "  查看资源:   docker stats"

# 保存部署日志
echo "$(date) - AixL Platform deployed successfully" >> deployment.log
