# ============================================
# AixL Backend Dockerfile (Production)
# 使用字节码编译保护源码
# ============================================

# 阶段1: 构建
FROM node:20-alpine AS builder

WORKDIR /app

# 安装构建依赖
RUN apk add --no-cache python3 make g++

# 复制依赖文件
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install

# 复制源码并构建
COPY . .
RUN npm run build

# 生成 Prisma Client
RUN npx prisma generate

# 后端保护：将 dist/*.js 编译为 V8 字节码（.jsc），输出到 compiled/
RUN node scripts/compile.js

# 阶段2: 生产镜像（使用字节码，不暴露源码）
FROM node:20-alpine AS production

WORKDIR /app

# 创建非root用户（安全最佳实践）
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# 使用编译后的字节码目录作为 dist（内含 .jsc + 加载器 .js），需 bytenode 运行时
COPY --from=builder /app/compiled ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 复制 Prisma schema 和迁移文件（数据库初始化/升级必需）
# 注意: 只包含 schema 和 SQL 迁移，不含业务源码
COPY --from=builder /app/prisma ./prisma

# 创建启动脚本: 先执行数据库迁移，再启动应用
RUN printf '#!/bin/sh\nset -e\necho "Running database migrations..."\nnpx prisma migrate deploy 2>/dev/null || echo "Migration skipped (DB may already be up to date)"\necho "Starting server..."\nexec node dist/main.js\n' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

# 环境变量
ENV NODE_ENV=production
ENV PORT=3001

# 更改文件权限：只读（entrypoint 需要可执行）
RUN chown -R appuser:nodejs /app && \
    chmod -R 550 /app/dist && \
    chmod -R 550 /app/node_modules && \
    chmod -R 550 /app/prisma && \
    chmod 550 /app/entrypoint.sh

USER appuser

# 健康检查
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3001/health || exit 1

EXPOSE 3001

# 启动命令: 先迁移再启动
CMD ["/app/entrypoint.sh"]
