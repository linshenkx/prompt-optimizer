FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN npm install -g corepack@latest && corepack enable

FROM base AS build
COPY . /app
WORKDIR /app
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build
RUN pnpm mcp:build

FROM nginx:stable-alpine
# 安装Node.js、htpasswd工具、dos2unix和supervisor
RUN apk add --no-cache apache2-utils dos2unix supervisor nodejs npm gettext curl

# 安装pnpm
RUN npm install -g pnpm

# 复制Nginx配置模板
COPY docker/nginx.conf.template /etc/nginx/conf.d/nginx.conf.template

# 复制Web应用
COPY --from=build /app/packages/web/dist /usr/share/nginx/html

# 复制MCP服务器
COPY --from=build /app/packages/mcp-server/dist /app/mcp-server/dist
COPY --from=build /app/packages/mcp-server/package.json /app/mcp-server/
COPY --from=build /app/packages/mcp-server/preload-env.js /app/mcp-server/
COPY --from=build /app/packages/mcp-server/preload-env.cjs /app/mcp-server/
# 复制构建后的包到正确位置
COPY --from=build /app/packages /app/packages
# 复制必要的node_modules
COPY --from=build /app/node_modules /app/node_modules

# 设置默认环境变量（向前兼容）
ENV NGINX_PORT=80

# 设置MCP服务器工作目录
WORKDIR /app/mcp-server

# 复制并设置启动脚本
COPY docker/generate-config.sh /docker-entrypoint.d/40-generate-config.sh
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf
COPY docker/start-services.sh /start-services.sh

# 确保脚本有执行权限
RUN chmod +x /docker-entrypoint.d/40-generate-config.sh
RUN chmod +x /start-services.sh

# 转换可能的Windows行尾符为Unix格式
RUN dos2unix /docker-entrypoint.d/40-generate-config.sh
RUN dos2unix /start-services.sh

EXPOSE 80

# 使用自定义启动脚本
CMD ["sh", "/start-services.sh"]