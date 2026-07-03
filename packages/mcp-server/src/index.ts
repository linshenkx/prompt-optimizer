#!/usr/bin/env node

/*
 * Prompt Optimizer - AI prompt optimization toolkit
 * Copyright (C) 2025 linshenkx
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * MCP Server for Prompt Optimizer
 *
 * Provides 3 core tools:
 * - optimize-user-prompt: optimize user prompts
 * - optimize-system-prompt: optimize system prompts
 * - iterate-prompt: iterate on existing prompts
 *
 * Supports both stdio and HTTP transports
 *
 * Note: environment variables are loaded by environment.ts during startup
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { ListToolsRequestSchema, CallToolRequestSchema, isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { CoreServicesManager } from './adapters/core-services.js';
import { loadConfig, type MCPServerConfig } from './config/environment.js';
import * as logger from './utils/logging.js';
import { ParameterValidator } from './adapters/parameter-adapter.js';
import { getTemplateOptions, getDefaultTemplateId } from './config/templates.js';
import { registerHealthzRoute } from './health.js';
import { randomUUID } from 'node:crypto';
import express from 'express';

const OPENAI_COMPATIBLE_PROXY_PATH = '/api/openai-compatible-proxy';
const OPENAI_PROXY_BASE_URL_HEADER = 'x-po-target-base-url';
const OPENAI_PROXY_CUSTOM_HEADERS_HEADER = 'x-po-custom-headers';
const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'content-encoding'
]);

function parseProxyJsonHeader(value: string | undefined): Record<string, string> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return undefined;
    }

    const result: Record<string, string> = {};
    Object.entries(parsed).forEach(([key, rawValue]) => {
      if (typeof rawValue === 'string') {
        result[key] = rawValue;
      }
    });

    return Object.keys(result).length > 0 ? result : undefined;
  } catch {
    return undefined;
  }
}

function isAllowedProxyTarget(baseURL: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(baseURL);
  } catch {
    return false;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return false;
  }

  const hostname = parsed.hostname.toLowerCase();
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(hostname)) {
    return false;
  }

  return true;
}

function extractJsonRpcId(body: unknown): string | number | null {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return null;
  }

  const candidate = (body as { id?: unknown }).id;
  if (typeof candidate === 'string' || typeof candidate === 'number' || candidate === null) {
    return candidate;
  }

  return null;
}

async function proxyOpenAICompatibleRequest(
  req: express.Request,
  res: express.Response,
  upstreamPath: string
): Promise<void> {
  const targetBaseURL = String(req.header(OPENAI_PROXY_BASE_URL_HEADER) || '').trim();
  if (!targetBaseURL || !isAllowedProxyTarget(targetBaseURL)) {
    res.status(400).json({ error: 'Invalid upstream base URL' });
    return;
  }

  const normalizedBase = targetBaseURL.endsWith('/') ? targetBaseURL : `${targetBaseURL}/`;
  const cleanPath = upstreamPath.startsWith('/') ? upstreamPath.slice(1) : upstreamPath;
  const targetURL = new URL(cleanPath, normalizedBase);

  const headers = new Headers();
  const authorization = req.header('authorization');
  if (authorization) {
    headers.set('authorization', authorization);
  }

  const contentType = req.header('content-type');
  if (contentType) {
    headers.set('content-type', contentType);
  }

  const customHeaders = parseProxyJsonHeader(req.header(OPENAI_PROXY_CUSTOM_HEADERS_HEADER));
  if (customHeaders) {
    Object.entries(customHeaders).forEach(([key, value]) => {
      headers.set(key, value);
    });
  }

  logger.info(`Proxying openai-compatible request to ${targetURL.origin}${targetURL.pathname}`);

  const upstreamResponse = await fetch(targetURL, {
    method: req.method,
    headers,
    body: req.method === 'GET' ? undefined : JSON.stringify(req.body),
    signal: AbortSignal.timeout(300000)
  });

  logger.info(`Upstream response status: ${upstreamResponse.status} ${upstreamResponse.statusText}`);

  res.status(upstreamResponse.status);
  upstreamResponse.headers.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      res.setHeader(key, value);
    }
  });

  const body = upstreamResponse.body;
  if (!body) {
    res.end();
    return;
  }

  const reader = body.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    if (value) {
      res.write(Buffer.from(value));
    }
  }

  res.end();
}

function registerOpenAICompatibleProxyRoutes(app: express.Express): void {
  app.post(`${OPENAI_COMPATIBLE_PROXY_PATH}/chat/completions`, async (req, res) => {
    try {
      await proxyOpenAICompatibleRequest(req, res, '/chat/completions');
    } catch (error) {
      logger.error('OpenAI-compatible proxy request failed', error as Error);
      if (!res.headersSent) {
        res.status(502).json({ error: (error as Error).message || 'Proxy request failed' });
      }
    }
  });

  app.post(`${OPENAI_COMPATIBLE_PROXY_PATH}/responses`, async (req, res) => {
    try {
      await proxyOpenAICompatibleRequest(req, res, '/responses');
    } catch (error) {
      logger.error('OpenAI-compatible proxy request failed', error as Error);
      if (!res.headersSent) {
        res.status(502).json({ error: (error as Error).message || 'Proxy request failed' });
      }
    }
  });

  app.get(`${OPENAI_COMPATIBLE_PROXY_PATH}/models`, async (req, res) => {
    try {
      await proxyOpenAICompatibleRequest(req, res, '/models');
    } catch (error) {
      logger.error('OpenAI-compatible proxy request failed', error as Error);
      if (!res.headersSent) {
        res.status(502).json({ error: (error as Error).message || 'Proxy request failed' });
      }
    }
  });
}

// 创建服务器实例的工厂函数
async function createServerInstance(config: MCPServerConfig) {
  // 创建 MCP Server 实例 - 使用正确的 API
  const server = new Server({
    name: 'prompt-optimizer-mcp-server',
    version: '0.1.0'
  }, {
    capabilities: {
      tools: {}
    }
  });

  // 初始化 Core 服务（每个服务器实例独立）
  const coreServices = CoreServicesManager.getInstance();
  await coreServices.initialize(config);

  return { server, coreServices };
}

// 设置服务器工具和处理器的函数
async function setupServerHandlers(server: Server, coreServices: CoreServicesManager) {

  // 获取模板选项和默认模板ID用于工具定义
  logger.info('Loading template options...');
  const templateManager = coreServices.getTemplateManager();
  const [userOptimizeOptions, systemOptimizeOptions, iterateOptions, userDefaultId, systemDefaultId, iterateDefaultId] = await Promise.all([
    getTemplateOptions(templateManager, 'userOptimize'),
    getTemplateOptions(templateManager, 'optimize'),
    getTemplateOptions(templateManager, 'iterate'),
    getDefaultTemplateId(templateManager, 'user'),
    getDefaultTemplateId(templateManager, 'system'),
    getDefaultTemplateId(templateManager, 'iterate')
  ]);

  // 注册工具列表处理器
  logger.info('Registering MCP tools...');
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: "optimize-user-prompt",
          description: "Optimize a user prompt to improve clarity, specificity, and overall response quality. Best for everyday chat, Q&A, writing, and task-oriented requests.\n\nKey capabilities:\n- Make the request clearer and more specific\n- Add missing context when useful\n- Improve wording and logical structure\n- Help the model understand the goal more accurately\n\nTypical use cases:\n- Turn a vague question into a concrete request\n- Add detailed constraints to a creative task\n- Improve the framing of a technical question",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "The user prompt to optimize. For example: 'Help me write an article' or 'Explain machine learning'."
              },
              template: {
                type: "string",
                description: `Choose an optimization template. Different templates fit different scenarios:\n${userOptimizeOptions.map(opt => `- ${opt.label}: ${opt.description}`).join('\n')}`,
                enum: userOptimizeOptions.map(opt => opt.value),
                default: userDefaultId
              }
            },
            required: ["prompt"]
          }
        },
        {
          name: "optimize-system-prompt",
          description: "Optimize a system prompt to improve role definition, instruction quality, and behavior control. Best for custom assistants, expert roles, and structured dialogue systems.\n\nKey capabilities:\n- Strengthen role definition and professionalism\n- Improve behavioral guidance and constraints\n- Refine instruction structure and hierarchy\n- Add missing domain context when needed\n\nTypical use cases:\n- Turn a simple role description into a professional system prompt\n- Add clearer operating rules for an AI assistant\n- Improve a domain-specific expert prompt",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "The system prompt to optimize. For example: 'You are a helpful assistant' or 'You are a medical advisor'."
              },
              template: {
                type: "string",
                description: `Choose an optimization template. Different templates fit different scenarios:\n${systemOptimizeOptions.map(opt => `- ${opt.label}: ${opt.description}`).join('\n')}`,
                enum: systemOptimizeOptions.map(opt => opt.value),
                default: systemDefaultId
              }
            },
            required: ["prompt"]
          }
        },
        {
          name: "iterate-prompt",
          description: "Iteratively improve an existing prompt based on concrete requirements. Best when you already have a usable prompt but need targeted refinements.\n\nKey capabilities:\n- Preserve the prompt's core intent\n- Improve it against specific requirements\n- Address known weaknesses or output issues\n- Adapt it to new scenarios or constraints\n\nTypical use cases:\n- Improve a prompt that is close but not good enough\n- Adapt a prompt to new business or product needs\n- Fix output formatting or content issues\n- Strengthen a specific aspect of performance",
          inputSchema: {
            type: "object",
            properties: {
              prompt: {
                type: "string",
                description: "The existing prompt to refine. This should be a complete prompt that is already in use but needs improvement."
              },
              requirements: {
                type: "string",
                description: "The concrete improvement requirements or problem statement. For example: 'The output format is inconsistent', 'Use a more professional tone', or 'Increase creativity'."
              },
              template: {
                type: "string",
                description: `Choose an iteration template. Different templates use different refinement strategies:\n${iterateOptions.map(opt => `- ${opt.label}: ${opt.description}`).join('\n')}`,
                enum: iterateOptions.map(opt => opt.value),
                default: iterateDefaultId
              }
            },
            required: ["prompt", "requirements"]
          }
        }
      ]
    };
  });

  // 注册工具调用处理器
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    logger.info(`Handling tool call request: ${name}`);

    try {
      switch (name) {
        case "optimize-user-prompt": {
          const { prompt, template } = args as { prompt?: string; template?: string };

          if (!prompt) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: Missing required parameter 'prompt'"
              }]
            };
          }

          // 参数验证
          ParameterValidator.validatePrompt(prompt);
          if (template) {
            ParameterValidator.validateTemplate(template);
          }

          // 调用 Core 服务
          const promptService = coreServices.getPromptService();
          const modelManager = coreServices.getModelManager();
          const templateManager = coreServices.getTemplateManager();

          // 检查 MCP 默认模型是否可用
          const mcpModel = await modelManager.getModel('mcp-default');
          if (!mcpModel || !mcpModel.enabled) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: The MCP default model is not configured or not enabled. Check the environment configuration."
              }]
            };
          }

          const templateId = template || await getDefaultTemplateId(templateManager, 'user');
          const result = await promptService.optimizePrompt({
            targetPrompt: prompt,
            modelKey: 'mcp-default',
            optimizationMode: 'user',
            templateId
          });

          return {
            content: [{
              type: "text",
              text: result
            }]
          };
        }

        case "optimize-system-prompt": {
          const { prompt, template } = args as { prompt?: string; template?: string };

          if (!prompt) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: Missing required parameter 'prompt'"
              }]
            };
          }

          // 参数验证
          ParameterValidator.validatePrompt(prompt);
          if (template) {
            ParameterValidator.validateTemplate(template);
          }

          // 调用 Core 服务
          const promptService = coreServices.getPromptService();
          const modelManager = coreServices.getModelManager();
          const templateManager = coreServices.getTemplateManager();

          // 检查 MCP 默认模型是否可用
          const mcpModel = await modelManager.getModel('mcp-default');
          if (!mcpModel || !mcpModel.enabled) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: The MCP default model is not configured or not enabled. Check the environment configuration."
              }]
            };
          }

          const templateId = template || await getDefaultTemplateId(templateManager, 'system');
          const result = await promptService.optimizePrompt({
            targetPrompt: prompt,
            modelKey: 'mcp-default',
            optimizationMode: 'system',
            templateId
          });

          return {
            content: [{
              type: "text",
              text: result
            }]
          };
        }

        case "iterate-prompt": {
          const { prompt, requirements, template } = args as {
            prompt?: string;
            requirements?: string;
            template?: string
          };

          if (!prompt) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: Missing required parameter 'prompt'"
              }]
            };
          }

          if (!requirements) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: Missing required parameter 'requirements'"
              }]
            };
          }

          // 参数验证
          ParameterValidator.validatePrompt(prompt);
          ParameterValidator.validateRequirements(requirements);
          if (template) {
            ParameterValidator.validateTemplate(template);
          }

          // 调用 Core 服务
          const promptService = coreServices.getPromptService();
          const modelManager = coreServices.getModelManager();
          const templateManager = coreServices.getTemplateManager();

          // 检查 MCP 默认模型是否可用
          const mcpModel = await modelManager.getModel('mcp-default');
          if (!mcpModel || !mcpModel.enabled) {
            return {
              isError: true,
              content: [{
                type: "text",
                text: "Error: The MCP default model is not configured or not enabled. Check the environment configuration."
              }]
            };
          }

          const templateId = template || await getDefaultTemplateId(templateManager, 'iterate');
          const result = await promptService.iteratePrompt(
            prompt,
            prompt, // 使用原始提示词作为上次优化的提示词
            requirements,
            'mcp-default',
            templateId
          );

          return {
            content: [{
              type: "text",
              text: result
            }]
          };
        }

        default:
          return {
            isError: true,
            content: [{
              type: "text",
              text: `Error: Unknown tool '${name}'`
            }]
          };
      }
    } catch (error) {
      logger.error(`Tool execution error ${name}:`, error as Error);
      return {
        isError: true,
        content: [{
          type: "text",
          text: `Tool execution error: ${(error as Error).message}`
        }]
      };
    }
  });

  logger.info('MCP tools registered successfully');
}

async function main() {
  const config = loadConfig();
  logger.setLogLevel(config.logLevel);

  try {
    // 解析命令行参数
    const args = process.argv.slice(2);
    const transport = args.find(arg => arg.startsWith('--transport='))?.split('=')[1] || 'stdio';
    const port = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || config.httpPort.toString());

    logger.info('Starting MCP Server for Prompt Optimizer');
    logger.info(`Transport: ${transport}, Port: ${port}`);

    // 启动传输层
    if (transport === 'http') {
      logger.info('Starting HTTP server with session management...');
      const app = express();
      app.use(express.json());

      // 代理路由不依赖 Core 服务，优先注册
      registerOpenAICompatibleProxyRoutes(app);

      // 初始化 Core 服务（需要 API Key，失败不影响代理功能）
      let coreServices: CoreServicesManager | null = null;
      try {
        logger.info('Initializing Core services...');
        coreServices = CoreServicesManager.getInstance();
        await coreServices.initialize(config);
        logger.info('Core services initialized successfully');
      } catch (initError) {
        logger.warn('Core services initialization failed, MCP tools unavailable', initError as Error);
      }

      if (coreServices) {
        registerHealthzRoute(app, coreServices);
      }
      logger.info('Express app configured');

      // 存储每个会话的传输实例
      const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      // 处理 POST 请求（客户端到服务器通信）
      app.post('/mcp', async (req, res) => {
        // 检查现有会话ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let httpTransport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // 重用现有传输
          httpTransport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
          if (!coreServices) {
            res.status(503).json({
              jsonrpc: '2.0',
              error: {
                code: -32000,
                message: 'MCP tools are unavailable because Core services failed to initialize',
              },
              id: extractJsonRpcId(req.body),
            });
            return;
          }

          // 新的初始化请求 - 为每个会话创建独立的服务器实例
          httpTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
              // 存储传输实例
              transports[sessionId] = httpTransport;
            },
            // MCP 协议不需要复杂的 CORS 配置，允许所有来源
            allowedOrigins: ['*'],
            enableDnsRebindingProtection: false
          });

          // 清理传输实例
          httpTransport.onclose = () => {
            if (httpTransport.sessionId) {
              delete transports[httpTransport.sessionId];
            }
          };

          // 为每个会话创建独立的服务器实例
          const { server } = await createServerInstance(config);
          await setupServerHandlers(server, coreServices);

          // 连接到 MCP 服务器
          await server.connect(httpTransport);
        } else {
          // 无效请求
          res.status(400).json({
            jsonrpc: '2.0',
            error: {
              code: -32000,
              message: 'Bad Request: No valid session ID provided',
            },
            id: null,
          });
          return;
        }

        // 处理请求
        await httpTransport.handleRequest(req, res, req.body);
      });

      // 处理 GET 请求（服务器到客户端通知，通过 SSE）
      app.get('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }

        const httpTransport = transports[sessionId];
        await httpTransport.handleRequest(req, res);
      });

      // 处理 DELETE 请求（会话终止）
      app.delete('/mcp', async (req, res) => {
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        if (!sessionId || !transports[sessionId]) {
          res.status(400).send('Invalid or missing session ID');
          return;
        }

        const httpTransport = transports[sessionId];
        await httpTransport.handleRequest(req, res);
      });

      logger.info('Setting up HTTP server listener...');
      app.listen(port, () => {
        logger.info(`MCP Server running on HTTP port ${port} with session management`);
      });
      logger.info('HTTP server setup completed');
    } else {
      // stdio 模式 - 创建单个服务器实例
      const { server, coreServices } = await createServerInstance(config);
      await setupServerHandlers(server, coreServices);

      const stdioTransport = new StdioServerTransport();
      await server.connect(stdioTransport);
      logger.info('MCP Server running on stdio');
    }

  } catch (error) {
    // 确保错误信息始终显示，即使没有启用 DEBUG
    console.error('❌ MCP Server startup failed:');
    console.error('   ', (error as Error).message);

    // 同时使用 debug 库记录详细信息
    logger.error('Failed to start MCP Server', error as Error);

    process.exit(1);
  }
}

// 处理未捕获的异常
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

// 导出 main 函数供外部调用
export { main };

// 创建一个单独的启动文件，避免在构建时执行
