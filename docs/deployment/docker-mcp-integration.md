# Docker中的MCP服务器集成

## 概述

现在Docker容器同时运行两个服务：
1. **Web应用** (Nginx) - 端口80
2. **MCP服务器** (Node.js) - 端口3000

使用Supervisor管理多个进程，确保服务的稳定运行。

## 架构图

```
Docker容器
├── Nginx (端口80)
│   ├── Web应用 (/)
│   └── MCP代理 (/mcp -> localhost:3000)
├── MCP服务器 (端口3000)
└── Supervisor (进程管理)
```

## 端口映射

- **8081:80** - Web应用访问端口
- **3000:3000** - MCP服务器直接访问端口（可选）

## 环境变量配置

### Web应用配置
```bash
VITE_OPENAI_API_KEY=sk-your-key
VITE_GEMINI_API_KEY=your-key
VITE_GROK_API_KEY=your-xai-key
# ... 其他Web应用API配置
```

### MCP服务器配置
```bash
# 基础配置
MCP_HTTP_PORT=3000
MCP_LOG_LEVEL=info
MCP_ENABLE_CORS=true
MCP_ALLOWED_ORIGINS=*

# 模型配置（必需）
MCP_DEFAULT_MODEL_PROVIDER=openai
MCP_DEFAULT_MODEL_NAME=gpt-4
MCP_DEFAULT_MODEL_API_KEY=sk-your-key
MCP_DEFAULT_MODEL_BASE_URL=
```

## 使用方法

### 1. 配置环境变量
```bash
cp env.local.example .env
# 编辑.env文件，填入实际的API密钥
```

由于 Compose 文件位于 `docker/` 目录下，下面的生产环境命令都显式传入仓库根目录的 `.env` 文件。

### 2. 启动服务
```bash
docker compose --env-file .env -f docker/docker-compose.yml up -d
```

### 3. 访问服务
- **Web应用**: http://localhost:8081
- **MCP服务器**: 
  - 直接访问: http://localhost:3000
  - 通过代理: http://localhost:8081/mcp

### 4. 健康检查
```bash
# 检查容器状态
docker compose --env-file .env -f docker/docker-compose.yml ps

# 查看日志
docker compose --env-file .env -f docker/docker-compose.yml logs -f

# 查看MCP服务器日志
docker compose --env-file .env -f docker/docker-compose.yml exec prompt-optimizer supervisorctl tail -f mcp-server
```

## MCP服务器API

### 获取工具列表
```bash
curl -X POST http://localhost:8081/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc": "2.0", "id": 1, "method": "tools/list"}'
```

### 调用工具
```bash
curl -X POST http://localhost:8081/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "optimize-user-prompt",
      "arguments": {
        "prompt": "写一个故事",
        "template": "user-prompt-basic"
      }
    }
  }'
```

## 故障排除

### 查看服务状态
```bash
docker compose --env-file .env -f docker/docker-compose.yml exec prompt-optimizer supervisorctl status
```

### 重启MCP服务器
```bash
docker compose --env-file .env -f docker/docker-compose.yml exec prompt-optimizer supervisorctl restart mcp-server
```

### 查看详细日志
```bash
# Nginx日志
docker compose --env-file .env -f docker/docker-compose.yml exec prompt-optimizer tail -f /var/log/nginx/error.log

# MCP服务器日志
docker compose --env-file .env -f docker/docker-compose.yml exec prompt-optimizer tail -f /var/log/supervisor/mcp-server.out.log
```

## 开发模式

如果需要在开发模式下运行，可以使用 `docker/docker-compose.dev.yml`：

```yaml
services:
  globalcloud-xiaoc:
    build:
      context: ..
      dockerfile: Dockerfile
    # ... 其他配置
```

然后重新构建：
```bash
docker compose -f docker/docker-compose.dev.yml up --build -d
```
