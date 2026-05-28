# ============================================
# AixL License Server Dockerfile
# ============================================

# 阶段1: 构建
FROM node:18-alpine AS builder

WORKDIR /app

COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
RUN npm run build
RUN npx prisma generate

# 阶段2: 生产镜像
FROM node:18-alpine AS production

WORKDIR /app

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./

ENV NODE_ENV=production
ENV PORT=4000

# 创建启动脚本: 先执行数据库迁移，再启动应用
RUN printf '#!/bin/sh\nset -e\necho "Running license-server database migrations..."\nnpx prisma migrate deploy 2>/dev/null || echo "Migration skipped"\necho "Starting license server..."\nexec node dist/main.js\n' > /app/entrypoint.sh && \
    chmod +x /app/entrypoint.sh

EXPOSE 4000

CMD ["/app/entrypoint.sh"]
