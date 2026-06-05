#!/usr/bin/env node

/*
 * GlobalCloud XiaoC - wiki-driven prompt engineering service
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
 * MCP Server for GlobalCloud XiaoC
 *
 * Provides wiki-context prompt engineering tools for Feishu, XGD, GPC,
 * Hermes, OpenClaw, and other MCP-compatible systems.
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
import { loadConfig, validateConfig, type MCPServerConfig } from './config/environment.js';
import * as logger from './utils/logging.js';
import { ParameterValidator } from './adapters/parameter-adapter.js';
import {
  buildPromptFitEvaluationPrompt,
  buildPromptWithXCContext,
  buildRequirementsWithXCContext,
  buildWikiPromptGoal,
  buildXCAdvancedVariables,
  getXCContextSchemaProperties,
  validateXCContext,
  type XCContextArgs
} from './adapters/xc-context.js';
import { getTemplateOptions, getDefaultTemplateId } from './config/templates.js';
import { randomUUID, timingSafeEqual } from 'node:crypto';
import express, { type NextFunction, type Request, type Response } from 'express';

// 创建服务器实例的工厂函数
async function createServerInstance(config: MCPServerConfig) {
  // 创建 MCP Server 实例 - 使用正确的 API
  const server = new Server({
    name: 'globalcloud-xiaoc-mcp-server',
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

const xcContextSchemaProperties = getXCContextSchemaProperties();

function mergeProperties(...groups: Record<string, unknown>[]): Record<string, unknown> {
  return Object.assign({}, ...groups);
}

function textResult(text: string) {
  return {
    content: [{
      type: "text" as const,
      text
    }]
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{
      type: "text" as const,
      text: message
    }]
  };
}

async function ensureMCPModel(coreServices: CoreServicesManager): Promise<void> {
  const modelManager = coreServices.getModelManager();
  const mcpModel = await modelManager.getModel('mcp-default');
  if (!mcpModel || !mcpModel.enabled) {
    throw new Error('The MCP default model is not configured or not enabled. Check the environment configuration.');
  }
}

function getXCContextArgs(args: Record<string, unknown>): XCContextArgs {
  return {
    caller_system: args.caller_system as string | undefined,
    task_type: args.task_type as string | undefined,
    business_context: args.business_context as string | undefined,
    output_contract: args.output_contract as string | undefined,
    wiki_context: args.wiki_context as XCContextArgs['wiki_context'],
    source_refs: args.source_refs as XCContextArgs['source_refs']
  };
}

function createMCPAuthMiddleware(config: MCPServerConfig) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!config.authToken || req.method === 'OPTIONS') {
      next();
      return;
    }

    const bearerToken = extractBearerToken(req.headers.authorization);
    const headerToken = req.headers['x-xc-mcp-token'];
    const candidate = bearerToken || (typeof headerToken === 'string' ? headerToken : undefined);

    if (!candidate || !constantTimeEqual(candidate, config.authToken)) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid MCP auth token'
      });
      return;
    }

    next();
  };
}

function extractBearerToken(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  const match = value.match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : undefined;
}

function constantTimeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
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
          description: "Optimize a user prompt with task goals, wiki context, and business-system usage in mind. Best for prompts embedded in Feishu, XGD, GPC, Hermes, OpenClaw, or similar systems, as well as everyday chat, Q&A, writing, and task-oriented requests.\n\nKey capabilities:\n- Make the request clearer and more specific\n- Add missing wiki or business context when useful\n- Improve wording and logical structure\n- Help the model understand the goal more accurately\n\nTypical use cases:\n- Turn a vague business request into a concrete prompt\n- Convert wiki rules or procedures into executable task instructions\n- Add detailed constraints to a creative or technical task\n- Improve the framing of a question before sending it to an LLM",
          inputSchema: {
            type: "object",
            properties: mergeProperties({
              prompt: {
                type: "string",
                description: "The user prompt to optimize. It may include wiki excerpts, business context, or a plain request. For example: 'Help me write an article', 'Explain machine learning', or 'Generate a Feishu task summary from this wiki procedure'."
              },
              template: {
                type: "string",
                description: `Choose an optimization template. Different templates fit different scenarios:\n${userOptimizeOptions.map(opt => `- ${opt.label}: ${opt.description}`).join('\n')}`,
                enum: userOptimizeOptions.map(opt => opt.value),
                default: userDefaultId
              }
            }, xcContextSchemaProperties),
            required: ["prompt"]
          }
        },
        {
          name: "optimize-system-prompt",
          description: "Optimize a system prompt to improve role definition, instruction quality, and behavior control with wiki-derived rules and system context. Best for embedded assistants, expert roles, workflow agents, and structured dialogue systems.\n\nKey capabilities:\n- Strengthen role definition and professionalism\n- Convert wiki rules, procedures, and boundaries into operating instructions\n- Refine instruction structure and hierarchy\n- Add missing domain context when needed\n\nTypical use cases:\n- Turn a simple role description into a professional system prompt\n- Add clearer operating rules for a Feishu, XGD, GPC, Hermes, or OpenClaw assistant\n- Improve a domain-specific expert prompt",
          inputSchema: {
            type: "object",
            properties: mergeProperties({
              prompt: {
                type: "string",
                description: "The system prompt to optimize. It may include a role, system boundary, wiki rule, workflow policy, or assistant operating contract."
              },
              template: {
                type: "string",
                description: `Choose an optimization template. Different templates fit different scenarios:\n${systemOptimizeOptions.map(opt => `- ${opt.label}: ${opt.description}`).join('\n')}`,
                enum: systemOptimizeOptions.map(opt => opt.value),
                default: systemDefaultId
              }
            }, xcContextSchemaProperties),
            required: ["prompt"]
          }
        },
        {
          name: "iterate-prompt",
          description: "Iteratively improve an existing prompt based on concrete requirements. Best when you already have a usable prompt but need targeted refinements.\n\nKey capabilities:\n- Preserve the prompt's core intent\n- Improve it against specific requirements\n- Address known weaknesses or output issues\n- Adapt it to new scenarios or constraints\n\nTypical use cases:\n- Improve a prompt that is close but not good enough\n- Adapt a prompt to new business or product needs\n- Fix output formatting or content issues\n- Strengthen a specific aspect of performance",
          inputSchema: {
            type: "object",
            properties: mergeProperties({
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
            }, xcContextSchemaProperties),
            required: ["prompt", "requirements"]
          }
        },
        {
          name: "generate-wiki-prompt",
          description: "Generate a production-ready prompt from a business goal, caller-system contract, and supplied wiki context. Use this when Feishu, XGD, GPC, Hermes, OpenClaw, Web, or Desktop clients need an embedded prompt asset grounded in wiki rules and source boundaries.",
          inputSchema: {
            type: "object",
            properties: mergeProperties({
              goal: {
                type: "string",
                description: "The prompt engineering goal or business workflow to support."
              },
              template: {
                type: "string",
                description: `Choose a user prompt generation/optimization template:\n${userOptimizeOptions.map(opt => `- ${opt.label}: ${opt.description}`).join('\n')}`,
                enum: userOptimizeOptions.map(opt => opt.value),
                default: userDefaultId
              }
            }, xcContextSchemaProperties),
            required: ["goal"]
          }
        },
        {
          name: "evaluate-prompt-fit",
          description: "Evaluate whether a prompt is fit for an XC embedded prompt engineering use case. Returns a concise score, risks, missing context, and improvement plan grounded in the supplied wiki/caller context.",
          inputSchema: {
            type: "object",
            properties: mergeProperties({
              prompt: {
                type: "string",
                description: "The prompt to evaluate."
              },
              expected_use: {
                type: "string",
                description: "Expected business use, target system, or workflow where this prompt will run."
              }
            }, xcContextSchemaProperties),
            required: ["prompt"]
          }
        }
      ]
    };
  });

  // 注册工具调用处理器
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const toolArgs = (args || {}) as Record<string, unknown>;
    logger.info(`Handling tool call request: ${name}`);

    try {
      switch (name) {
        case "optimize-user-prompt": {
          const { prompt, template } = toolArgs as { prompt?: string; template?: string };
          const xcContext = getXCContextArgs(toolArgs);

          if (!prompt) {
            return errorResult("Error: Missing required parameter 'prompt'");
          }

          // 参数验证
          ParameterValidator.validatePrompt(prompt);
          if (template) {
            ParameterValidator.validateTemplate(template);
          }
          validateXCContext(xcContext);

          // 调用 Core 服务
          const promptService = coreServices.getPromptService();
          const templateManager = coreServices.getTemplateManager();
          await ensureMCPModel(coreServices);

          const templateId = template || await getDefaultTemplateId(templateManager, 'user');
          const targetPrompt = buildPromptWithXCContext(prompt, xcContext);
          const result = await promptService.optimizePrompt({
            targetPrompt,
            modelKey: 'mcp-default',
            optimizationMode: 'user',
            templateId,
            advancedContext: {
              variables: buildXCAdvancedVariables(xcContext)
            }
          });

          return textResult(result);
        }

        case "optimize-system-prompt": {
          const { prompt, template } = toolArgs as { prompt?: string; template?: string };
          const xcContext = getXCContextArgs(toolArgs);

          if (!prompt) {
            return errorResult("Error: Missing required parameter 'prompt'");
          }

          // 参数验证
          ParameterValidator.validatePrompt(prompt);
          if (template) {
            ParameterValidator.validateTemplate(template);
          }
          validateXCContext(xcContext);

          // 调用 Core 服务
          const promptService = coreServices.getPromptService();
          const templateManager = coreServices.getTemplateManager();
          await ensureMCPModel(coreServices);

          const templateId = template || await getDefaultTemplateId(templateManager, 'system');
          const targetPrompt = buildPromptWithXCContext(prompt, xcContext);
          const result = await promptService.optimizePrompt({
            targetPrompt,
            modelKey: 'mcp-default',
            optimizationMode: 'system',
            templateId,
            advancedContext: {
              variables: buildXCAdvancedVariables(xcContext)
            }
          });

          return textResult(result);
        }

        case "iterate-prompt": {
          const { prompt, requirements, template } = toolArgs as {
            prompt?: string;
            requirements?: string;
            template?: string
          };
          const xcContext = getXCContextArgs(toolArgs);

          if (!prompt) {
            return errorResult("Error: Missing required parameter 'prompt'");
          }

          if (!requirements) {
            return errorResult("Error: Missing required parameter 'requirements'");
          }

          // 参数验证
          ParameterValidator.validatePrompt(prompt);
          ParameterValidator.validateRequirements(requirements);
          if (template) {
            ParameterValidator.validateTemplate(template);
          }
          validateXCContext(xcContext);

          // 调用 Core 服务
          const promptService = coreServices.getPromptService();
          const templateManager = coreServices.getTemplateManager();
          await ensureMCPModel(coreServices);

          const templateId = template || await getDefaultTemplateId(templateManager, 'iterate');
          const originalPrompt = buildPromptWithXCContext(prompt, xcContext);
          const iterateInput = buildRequirementsWithXCContext(requirements, xcContext);
          const result = await promptService.iteratePrompt(
            originalPrompt,
            originalPrompt,
            iterateInput,
            'mcp-default',
            templateId,
            {
              variables: buildXCAdvancedVariables(xcContext)
            }
          );

          return textResult(result);
        }

        case "generate-wiki-prompt": {
          const { goal, template } = toolArgs as { goal?: string; template?: string };
          const xcContext = getXCContextArgs(toolArgs);

          if (!goal) {
            return errorResult("Error: Missing required parameter 'goal'");
          }

          ParameterValidator.validatePrompt(goal);
          if (template) {
            ParameterValidator.validateTemplate(template);
          }
          validateXCContext(xcContext);

          const promptService = coreServices.getPromptService();
          const templateManager = coreServices.getTemplateManager();
          await ensureMCPModel(coreServices);

          const templateId = template || await getDefaultTemplateId(templateManager, 'user');
          const result = await promptService.optimizePrompt({
            targetPrompt: buildWikiPromptGoal(goal, xcContext),
            modelKey: 'mcp-default',
            optimizationMode: 'user',
            templateId,
            advancedContext: {
              variables: buildXCAdvancedVariables(xcContext)
            }
          });

          return textResult(result);
        }

        case "evaluate-prompt-fit": {
          const { prompt, expected_use } = toolArgs as { prompt?: string; expected_use?: string };
          const xcContext = getXCContextArgs(toolArgs);

          if (!prompt) {
            return errorResult("Error: Missing required parameter 'prompt'");
          }

          ParameterValidator.validatePrompt(prompt);
          if (expected_use) {
            ParameterValidator.validateRequirements(expected_use);
          }
          validateXCContext(xcContext);
          await ensureMCPModel(coreServices);

          const promptService = coreServices.getPromptService();
          const systemPrompt = [
            'You are GlobalCloud XiaoC (XC), a wiki-driven prompt engineering evaluator.',
            'Evaluate prompts for embedded MCP, Web, and Desktop usage across Feishu, XGD, GPC, Hermes, OpenClaw, and similar systems.',
            'Return valid compact JSON only. Do not include markdown fences.'
          ].join('\n');
          const userPrompt = buildPromptFitEvaluationPrompt(prompt, expected_use, xcContext);
          const result = await promptService.testPrompt(systemPrompt, userPrompt, 'mcp-default');

          return textResult(result);
        }

        default:
          return errorResult(`Error: Unknown tool '${name}'`);
      }
    } catch (error) {
      logger.error(`Tool execution error ${name}:`, error as Error);
      return errorResult(`Tool execution error: ${(error as Error).message}`);
    }
  });

  logger.info('MCP tools registered successfully');
}

async function main() {
  const config = loadConfig();
  validateConfig(config);
  logger.setLogLevel(config.logLevel);

  try {
    // 解析命令行参数
    const args = process.argv.slice(2);
    const transport = args.find(arg => arg.startsWith('--transport='))?.split('=')[1] || 'stdio';
    const port = parseInt(args.find(arg => arg.startsWith('--port='))?.split('=')[1] || config.httpPort.toString());

    logger.info('Starting MCP Server for GlobalCloud XiaoC');
    logger.info(`Transport: ${transport}, Port: ${port}`);

    // 初始化 Core 服务（一次性，用于验证配置）
    logger.info('Initializing Core services...');
    const coreServices = CoreServicesManager.getInstance();
    await coreServices.initialize(config);
    logger.info('Core services initialized successfully');

    // 启动传输层
    if (transport === 'http') {
      logger.info('Starting HTTP server with session management...');
      // 使用 Express 和会话管理支持多客户端连接
      const app = express();
      app.use(express.json());
      logger.info('Express app configured');

      // 存储每个会话的传输实例
      const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

      app.get('/healthz', async (_req, res) => {
        const health = await coreServices.getHealthStatus();
        res.status(health.initialized ? 200 : 503).json({
          status: health.initialized ? 'ok' : 'degraded',
          service: 'GlobalCloud XiaoC MCP',
          version: '0.1.0',
          transport: 'http',
          authRequired: Boolean(config.authToken),
          activeSessions: Object.keys(transports).length,
          ...health
        });
      });

      app.use('/mcp', createMCPAuthMiddleware(config));

      app.options('/mcp', (_req, res) => {
        res.setHeader('Access-Control-Allow-Origin', config.allowedOrigins.includes('*') ? '*' : config.allowedOrigins[0] || '');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, mcp-session-id, X-XC-MCP-Token');
        res.setHeader('Access-Control-Max-Age', '1728000');
        res.status(204).end();
      });

      // 处理 POST 请求（客户端到服务器通信）
      app.post('/mcp', async (req, res) => {
        // 检查现有会话ID
        const sessionId = req.headers['mcp-session-id'] as string | undefined;
        let httpTransport: StreamableHTTPServerTransport;

        if (sessionId && transports[sessionId]) {
          // 重用现有传输
          httpTransport = transports[sessionId];
        } else if (!sessionId && isInitializeRequest(req.body)) {
          // 新的初始化请求 - 为每个会话创建独立的服务器实例
          httpTransport = new StreamableHTTPServerTransport({
            sessionIdGenerator: () => randomUUID(),
            onsessioninitialized: (sessionId) => {
              // 存储传输实例
              transports[sessionId] = httpTransport;
            },
            allowedOrigins: config.allowedOrigins,
            enableDnsRebindingProtection: config.enableDnsRebindingProtection
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
      const { server } = await createServerInstance(config);
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
