#!/bin/sh

# 创建日志目录
mkdir -p /var/log/supervisor

# nginx配置已由generate-config.sh处理

# 运行原有的nginx初始化脚本
echo "Running nginx initialization scripts..."
for script in /docker-entrypoint.d/*.sh; do
    if [ -f "$script" ]; then
        echo "Running $script"
        sh "$script"
    fi
done

echo "Starting services with supervisor..."
echo "MCP Server will run on port: ${MCP_HTTP_PORT}"
echo "MCP Server log level: ${MCP_LOG_LEVEL}"

# 启动supervisor
exec /usr/bin/supervisord -c /etc/supervisor/conf.d/supervisord.conf
