#!/bin/bash

# ============================================
# AixL 远程服务器构建脚本
# 在您的授权服务器 (43.157.56.23) 上运行
# ============================================

set -e

echo "🔨 AixL 镜像构建开始"
echo "时间: $(date)"
echo ""

# 颜色定义
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_DIR="${1:-.}"
cd "$PROJECT_DIR"

# ============================================
# 检查前置条件
# ============================================
echo -e "${BLUE}[1/5] 检查前置条件...${NC}"

if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker 未安装${NC}"
    exit 1
fi

if ! command -v git &> /dev/null; then
    echo -e "${YELLOW}⚠️  Git 未安装（可选）${NC}"
fi

echo -e "${GREEN}✅ 前置条件检查完成${NC}"

# ============================================
# 第 1 个镜像: 后端
# ============================================
echo ""
echo -e "${BLUE}[2/5] 构建后端镜像...${NC}"

START_TIME=$(date +%s)

docker build \
    -f server/Dockerfile \
    -t aixl/backend:latest \
    -t aixl/backend:v1.0 \
    --build-arg NODE_ENV=production \
    --progress=plain \
    . 2>&1 | tail -20

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 后端镜像构建完成 (耗时: ${DURATION}秒)${NC}"
else
    echo -e "${RED}❌ 后端镜像构建失败${NC}"
    exit 1
fi

# ============================================
# 第 2 个镜像: 前端
# ============================================
echo ""
echo -e "${BLUE}[3/5] 构建前端镜像...${NC}"

START_TIME=$(date +%s)

docker build \
    -f Dockerfile \
    -t aixl/frontend:latest \
    -t aixl/frontend:v1.0 \
    --build-arg NODE_ENV=production \
    --progress=plain \
    . 2>&1 | tail -20

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 前端镜像构建完成 (耗时: ${DURATION}秒)${NC}"
else
    echo -e "${RED}❌ 前端镜像构建失败${NC}"
    exit 1
fi

# ============================================
# 第 3 个镜像: 管理后台
# ============================================
echo ""
echo -e "${BLUE}[4/5] 构建管理后台镜像...${NC}"

START_TIME=$(date +%s)

docker build \
    -f admin-web/Dockerfile \
    -t aixl/admin:latest \
    -t aixl/admin:v1.0 \
    --build-arg NODE_ENV=production \
    --progress=plain \
    . 2>&1 | tail -20

END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 管理后台镜像构建完成 (耗时: ${DURATION}秒)${NC}"
else
    echo -e "${RED}❌ 管理后台镜像构建失败${NC}"
    exit 1
fi

# ============================================
# 验证和导出
# ============================================
echo ""
echo -e "${BLUE}[5/5] 验证镜像并导出...${NC}"

echo "已构建的镜像:"
docker images | grep "aixl/"

# 创建导出目录
EXPORT_DIR="/tmp/docker-exports"
mkdir -p "$EXPORT_DIR"

echo ""
echo "导出镜像..."

docker save aixl/backend:latest | gzip > "$EXPORT_DIR/aixl-backend.tar.gz"
echo "✅ 后端镜像导出完成"

docker save aixl/frontend:latest | gzip > "$EXPORT_DIR/aixl-frontend.tar.gz"
echo "✅ 前端镜像导出完成"

docker save aixl/admin:latest | gzip > "$EXPORT_DIR/aixl-admin.tar.gz"
echo "✅ 管理后台镜像导出完成"

# ============================================
# 显示统计信息
# ============================================
echo ""
echo -e "${YELLOW}导出完成，文件统计:${NC}"
du -sh "$EXPORT_DIR"/*
echo ""
echo "镜像文件位置: $EXPORT_DIR"

# ============================================
# 生成上传命令
# ============================================
echo ""
echo -e "${GREEN}✅ 构建完成！${NC}"
echo ""
echo -e "${YELLOW}下一步 - 上传到甲方服务器:${NC}"
echo ""
echo "命令:"
echo "  scp -r $EXPORT_DIR/* root@51.75.69.234:/opt/aixl-platform/docker/"
echo ""
echo "然后在甲方服务器运行:"
echo "  cd /opt/aixl-platform"
echo "  ./deploy-production-client-secure.sh"
echo ""

# ============================================
# 可选: 保存为脚本
# ============================================
echo -e "${YELLOW}💡 提示:${NC}"
echo "可以通过以下命令自动上传镜像:"
echo ""
echo "cat > /tmp/upload.sh << 'SCRIPT'"
echo "#!/bin/bash"
echo "scp -r $EXPORT_DIR/* root@51.75.69.234:/opt/aixl-platform/docker/"
echo "echo '✅ 镜像已上传到甲方服务器'"
echo "SCRIPT"
echo ""
echo "bash /tmp/upload.sh"
echo ""
