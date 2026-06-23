#!/bin/bash

# ============================================
# AixL 镜像构建脚本
# 在乙方服务器上运行，NOT 在甲方服务器
# 使用方式: bash scripts/build-images.sh
# ============================================

set -e

echo "开始构建 Docker 镜像..."
echo "时间: $(date)"

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 从 .env.production 加载构建参数（如果存在）
if [ -f ".env.production" ]; then
    echo -e "${YELLOW}加载 .env.production 构建参数...${NC}"
    export $(grep -v '^#' .env.production | grep -v '^\s*$' | xargs)
fi

# 默认值
NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL:-https://superoctopus.fun/api}
NEXT_PUBLIC_WS_URL=${NEXT_PUBLIC_WS_URL:-wss://superoctopus.fun}
PRIVY_APP_ID=${PRIVY_APP_ID:-}
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=${NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID:-}
NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL=${NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL:-}
NEXT_PUBLIC_BSC_TESTNET_RPC_URL=${NEXT_PUBLIC_BSC_TESTNET_RPC_URL:-}

echo -e "${YELLOW}构建参数:${NC}"
echo "  API_URL: $NEXT_PUBLIC_API_URL"
echo "  WS_URL:  $NEXT_PUBLIC_WS_URL"
echo ""

# ============================================
# 1. 构建后端镜像 (context = server/)
# ============================================
echo -e "${YELLOW}[1/4] 构建后端镜像 (NestJS + Bytenode)...${NC}"
docker build \
  -t aixl/backend:latest \
  -t aixl/backend:v1.0 \
  ./server

echo -e "${GREEN}✅ 后端镜像构建完成${NC}"

# ============================================
# 2. 构建前端镜像 (context = ./)
# ============================================
echo -e "${YELLOW}[2/4] 构建前端镜像 (Next.js)...${NC}"
docker build \
  -t aixl/frontend:latest \
  -t aixl/frontend:v1.0 \
  --build-arg NEXT_PUBLIC_API_URL="$NEXT_PUBLIC_API_URL" \
  --build-arg NEXT_PUBLIC_WS_URL="$NEXT_PUBLIC_WS_URL" \
  --build-arg NEXT_PUBLIC_PRIVY_APP_ID="$PRIVY_APP_ID" \
  --build-arg NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID="$NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID" \
  --build-arg NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL="$NEXT_PUBLIC_XMARKET_INDEXER_API_BASE_URL" \
  --build-arg NEXT_PUBLIC_BSC_TESTNET_RPC_URL="$NEXT_PUBLIC_BSC_TESTNET_RPC_URL" \
  .

echo -e "${GREEN}✅ 前端镜像构建完成${NC}"

# ============================================
# 3. 构建管理后台镜像 (context = admin-web/)
# ============================================
echo -e "${YELLOW}[3/4] 构建管理后台镜像 (Admin)...${NC}"

ADMIN_API_URL=${NEXT_PUBLIC_ADMIN_API_URL:-https://superoctopus.fun/api}
ADMIN_WS_URL=${NEXT_PUBLIC_ADMIN_WS_URL:-wss://superoctopus.fun}

docker build \
  -t aixl/admin:latest \
  -t aixl/admin:v1.0 \
  --build-arg NEXT_PUBLIC_API_URL="$ADMIN_API_URL" \
  --build-arg NEXT_PUBLIC_WS_URL="$ADMIN_WS_URL" \
  ./admin-web

echo -e "${GREEN}✅ 管理后台镜像构建完成${NC}"

# ============================================
# 4. 构建 Indexer 镜像
# ============================================
echo -e "${YELLOW}[4/4] 构建 Indexer 镜像...${NC}"

docker build \
  -t aixl/indexer:latest \
  -t aixl/indexer:v1.0 \
  ./indexer

echo -e "${GREEN}✅ Indexer 镜像构建完成${NC}"

# ============================================
# 4. 验证镜像
# ============================================
echo ""
echo -e "${YELLOW}验证已构建的镜像:${NC}"
docker images | grep "aixl/"

# ============================================
# 5. 导出镜像为 tar 文件
# ============================================
echo ""
echo -e "${YELLOW}导出镜像...${NC}"

EXPORT_DIR="./docker-exports"
mkdir -p "$EXPORT_DIR"

echo "导出后端镜像..."
docker save aixl/backend:latest | gzip > "$EXPORT_DIR/aixl-backend.tar.gz"

echo "导出前端镜像..."
docker save aixl/frontend:latest | gzip > "$EXPORT_DIR/aixl-frontend.tar.gz"

echo "导出管理后台镜像..."
docker save aixl/admin:latest | gzip > "$EXPORT_DIR/aixl-admin.tar.gz"

echo "导出 Indexer 镜像..."
docker save aixl/indexer:latest | gzip > "$EXPORT_DIR/aixl-indexer.tar.gz"

# ============================================
# 6. 显示文件大小
# ============================================
echo ""
echo -e "${YELLOW}导出完成，文件大小:${NC}"
ls -lh "$EXPORT_DIR/"

echo ""
echo -e "${GREEN}✅ 所有镜像已准备好${NC}"
echo ""
echo -e "${YELLOW}下一步:${NC}"
echo "1. 上传镜像到甲方服务器:"
echo "   scp -r $EXPORT_DIR/* root@<甲方IP>:/opt/aixl-platform/docker/"
echo ""
echo "2. 上传部署配置到甲方服务器:"
echo "   scp docker-compose.production.yml root@<甲方IP>:/opt/aixl-platform/"
echo "   scp -r nginx/ root@<甲方IP>:/opt/aixl-platform/"
echo "   scp .env.production.example root@<甲方IP>:/opt/aixl-platform/"
echo "   scp scripts/deploy-production.sh root@<甲方IP>:/opt/aixl-platform/scripts/"
echo ""
echo "3. 在甲方服务器上运行部署脚本:"
echo "   cd /opt/aixl-platform"
echo "   bash scripts/deploy-production.sh"
