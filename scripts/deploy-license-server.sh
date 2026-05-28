#!/bin/bash

# ============================================
# AixL License Server 部署脚本
# 授权服务器 (43.157.56.23)
# ============================================

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

SERVER_IP="43.157.56.23"
PORT="4000"
APP_DIR="/opt/aixl-license-server"

echo -e "${YELLOW}╔════════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║  AixL License Server 部署脚本          ║${NC}"
echo -e "${YELLOW}║  部署地址: $SERVER_IP:$PORT${NC}"
echo -e "${YELLOW}╚════════════════════════════════════════╝${NC}"

# ========================================
# 第一步: 系统检查
# ========================================
echo -e "\n${YELLOW}[1/6] 系统检查...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    echo "请执行: curl https://get.docker.com | sh"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}❌ Docker Compose 未安装${NC}"
    echo "请执行: curl -L https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m) -o /usr/local/bin/docker-compose && chmod +x /usr/local/bin/docker-compose"
    exit 1
fi

echo -e "${GREEN}✅ Docker 版本: $(docker --version)${NC}"
echo -e "${GREEN}✅ Docker Compose 版本: $(docker-compose --version)${NC}"

# ========================================
# 第二步: 创建部署目录
# ========================================
echo -e "\n${YELLOW}[2/6] 准备部署目录...${NC}"

mkdir -p $APP_DIR
cd $APP_DIR

echo -e "${GREEN}✅ 部署目录: $APP_DIR${NC}"

# ========================================
# 第三步: 生成环境变量
# ========================================
echo -e "\n${YELLOW}[3/6] 生成环境变量配置...${NC}"

cat > .env.production << 'EOF'
# License Server 环境变量

# 服务器配置
NODE_ENV=production
PORT=4000
HOST=0.0.0.0

# 数据库配置（License Server 自己的数据库）
DATABASE_URL=postgresql://license_admin:license_secret_2026@postgres:5432/aixl_license

# 日志级别
LOG_LEVEL=info

# License 签名密钥（保密！）
LICENSE_SIGNING_KEY=your-secret-key-change-this-please-32-chars-minimum

# License 有效期配置
LICENSE_VALIDITY_DAYS=365
GRACE_PERIOD_DAYS=7
HEARTBEAT_INTERVAL_HOURS=6

# 部署机制
DEPLOYMENT_MODE=production
ALLOWED_REGIONS=CN,HK,SG,US,EU
EOF

echo -e "${GREEN}✅ 环境变量已生成: .env.production${NC}"
echo -e "${YELLOW}⚠️  请编辑 .env.production 中的 LICENSE_SIGNING_KEY${NC}"

# ========================================
# 第四步: 生成 docker-compose
# ========================================
echo -e "\n${YELLOW}[4/6] 生成 Docker Compose 配置...${NC}"

cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  # ============ License Server 数据库 ============
  postgres:
    image: postgres:15-alpine
    container_name: license-postgres
    restart: unless-stopped
    environment:
      POSTGRES_USER: license_admin
      POSTGRES_PASSWORD: license_secret_2026
      POSTGRES_DB: aixl_license
    volumes:
      - postgres_license_data:/var/lib/postgresql/data
    networks:
      - license-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U license_admin"]
      interval: 10s
      timeout: 5s
      retries: 5

  # ============ License Server ============
  license-server:
    image: node:20-alpine
    container_name: license-server
    restart: unless-stopped
    working_dir: /app
    volumes:
      - ./license-server:/app
    ports:
      - "4000:4000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgresql://license_admin:license_secret_2026@postgres:5432/aixl_license
      LICENSE_SIGNING_KEY: ${LICENSE_SIGNING_KEY}
    depends_on:
      postgres:
        condition: service_healthy
    networks:
      - license-network
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:4000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    command: >
      sh -c "npm install &&
             npx prisma migrate deploy &&
             npm run build &&
             npm start"

volumes:
  postgres_license_data:

networks:
  license-network:
    driver: bridge
EOF

echo -e "${GREEN}✅ Docker Compose 配置已生成${NC}"

# ========================================
# 第五步: 构建并启动
# ========================================
echo -e "\n${YELLOW}[5/6] 构建并启动 License Server...${NC}"

docker-compose build
docker-compose up -d

# 等待服务启动
echo -e "${YELLOW}等待服务启动...${NC}"
sleep 10

# ========================================
# 第六步: 验证部署
# ========================================
echo -e "\n${YELLOW}[6/6] 验证部署...${NC}"

# 检查容器状态
if docker ps | grep -q license-server; then
    echo -e "${GREEN}✅ License Server 容器已启动${NC}"
else
    echo -e "${RED}❌ License Server 容器启动失败${NC}"
    docker-compose logs license-server
    exit 1
fi

# 检查数据库连接
if docker-compose logs postgres | grep -q "database system is ready"; then
    echo -e "${GREEN}✅ PostgreSQL 数据库已就绪${NC}"
else
    echo -e "${YELLOW}⚠️  数据库初始化中，请稍候...${NC}"
fi

# 健康检查
for i in {1..30}; do
    if curl -s http://localhost:4000/health > /dev/null; then
        echo -e "${GREEN}✅ License Server 健康检查通过${NC}"
        break
    fi
    if [ $i -eq 30 ]; then
        echo -e "${RED}❌ License Server 无响应${NC}"
        docker-compose logs license-server
        exit 1
    fi
    sleep 1
done

# ========================================
# 完成
# ========================================
echo -e "\n${GREEN}╔════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  部署完成！                             ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════╝${NC}"

echo -e "\n📋 License Server 信息:"
echo -e "  地址: http://43.157.56.23:4000"
echo -e "  健康检查: curl http://43.157.56.23:4000/health"
echo -e "  API文档: http://43.157.56.23:4000/api/docs"

echo -e "\n📝 重要提醒:"
echo -e "  1. 编辑 .env.production 中的 LICENSE_SIGNING_KEY"
echo -e "  2. 配置防火墙允许 4000 端口访问"
echo -e "  3. 定期备份数据库: docker-compose exec postgres pg_dump -U license_admin aixl_license > backup.sql"
echo -e "  4. 监控日志: docker-compose logs -f license-server"

echo -e "\n🔗 后续步骤:"
echo -e "  在甲方服务器部署时，将以下信息写入 .env.production:"
echo -e "    LICENSE_SERVER=http://43.157.56.23:4000"
echo -e "    LICENSE_KEY=<从License Server生成>"

# ========================================
# 保存部署日志
# ========================================
echo ""
docker-compose ps
echo ""
date >> deployment.log
echo "License Server deployed successfully" >> deployment.log
