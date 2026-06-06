import { describe, expect, it, vi } from 'vitest';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Server } from '@modelcontextprotocol/sdk/server/index.js';

import type { CoreServicesManager } from '../src/adapters/core-services.js';
import { setupServerHandlers } from '../src/index.js';

type Handler = (request: { params?: Record<string, unknown> }) => Promise<unknown>;

function createFakeServer() {
  const handlers = new Map<string, Handler>();
  return {
    handlers,
    server: {
      setRequestHandler(schema: { shape?: { method?: { value?: string } } }, handler: Handler) {
        const method = schema.shape?.method?.value;
        if (!method) {
          throw new Error('Missing schema method');
        }
        handlers.set(method, handler);
      }
    } as unknown as Server
  };
}

function createFakeCoreServices(options?: { modelEnabled?: boolean }) {
  const templateManager = {
    listTemplatesByType: vi.fn(async (type: string) => [{
      id: `${type}-default`,
      name: `${type} default`,
      isBuiltin: true,
      metadata: { description: `${type} description` }
    }])
  };

  const promptService = {
    optimizePrompt: vi.fn(async () => 'MOCK_OPTIMIZED_PROMPT'),
    iteratePrompt: vi.fn(async () => 'MOCK_ITERATED_PROMPT'),
    testPrompt: vi.fn(async () => '{"score":0.91,"risks":[]}')
  };

  const modelManager = {
    getModel: vi.fn(async () => ({ id: 'mcp-default', enabled: options?.modelEnabled ?? true }))
  };

  const coreServices = {
    getTemplateManager: () => templateManager,
    getPromptService: () => promptService,
    getModelManager: () => modelManager
  } as unknown as CoreServicesManager;

  return { coreServices, templateManager, promptService, modelManager };
}

describe('MCP tool success paths', () => {
  it('executes optimize-user-prompt with caller and wiki context', async () => {
    const { server, handlers } = createFakeServer();
    const { coreServices, promptService, modelManager } = createFakeCoreServices();

    await setupServerHandlers(server, coreServices);

    const callTool = handlers.get(CallToolRequestSchema.shape.method.value)!;
    const result = await callTool({
      params: {
        name: 'optimize-user-prompt',
        arguments: {
          prompt: 'Summarize the latest confirmed wiki procedure.',
          caller_system: 'feishu',
          task_type: 'wiki_summary',
          output_contract: 'Return concise Chinese bullets.',
          wiki_context: {
            query: 'procedure',
            scope: 'ops/wiki',
            chunks: ['Only use confirmed procedures.']
          }
        }
      }
    }) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0]).toEqual({ type: 'text', text: 'MOCK_OPTIMIZED_PROMPT' });
    expect(modelManager.getModel).toHaveBeenCalledWith('mcp-default');
    expect(promptService.optimizePrompt).toHaveBeenCalledWith(expect.objectContaining({
      modelKey: 'mcp-default',
      optimizationMode: 'user',
      templateId: 'userOptimize-default'
    }));
    expect(promptService.optimizePrompt.mock.calls[0][0].targetPrompt).toContain('[XC Context]');
    expect(promptService.optimizePrompt.mock.calls[0][0].targetPrompt).toContain('Caller System: feishu');
    expect(promptService.optimizePrompt.mock.calls[0][0].targetPrompt).toContain('[Original Prompt]');
    expect(promptService.optimizePrompt.mock.calls[0][0].advancedContext.variables).toEqual(expect.objectContaining({
      xcCallerSystem: 'feishu',
      xcTaskType: 'wiki_summary',
      xcOutputContract: 'Return concise Chinese bullets.'
    }));
  });

  it('executes optimize-system-prompt with the system template type', async () => {
    const { server, handlers } = createFakeServer();
    const { coreServices, promptService } = createFakeCoreServices();

    await setupServerHandlers(server, coreServices);

    const callTool = handlers.get(CallToolRequestSchema.shape.method.value)!;
    const result = await callTool({
      params: {
        name: 'optimize-system-prompt',
        arguments: {
          prompt: 'You are a wiki-grounded Feishu assistant.',
          caller_system: 'feishu',
          business_context: 'Embedded prompt engineering service'
        }
      }
    }) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0]).toEqual({ type: 'text', text: 'MOCK_OPTIMIZED_PROMPT' });
    expect(promptService.optimizePrompt).toHaveBeenCalledWith(expect.objectContaining({
      modelKey: 'mcp-default',
      optimizationMode: 'system',
      templateId: 'optimize-default'
    }));
    expect(promptService.optimizePrompt.mock.calls[0][0].targetPrompt).toContain('Business Context:');
    expect(promptService.optimizePrompt.mock.calls[0][0].advancedContext.variables).toEqual(expect.objectContaining({
      xcBusinessContext: 'Embedded prompt engineering service'
    }));
  });

  it('executes iterate-prompt with contextual requirements', async () => {
    const { server, handlers } = createFakeServer();
    const { coreServices, promptService } = createFakeCoreServices();

    await setupServerHandlers(server, coreServices);

    const callTool = handlers.get(CallToolRequestSchema.shape.method.value)!;
    const result = await callTool({
      params: {
        name: 'iterate-prompt',
        arguments: {
          prompt: 'Draft a task handoff prompt.',
          requirements: 'Add explicit source boundary and output format.',
          caller_system: 'hermes',
          source_refs: [{ id: 'wiki-2', title: 'Handoff SOP' }]
        }
      }
    }) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0]).toEqual({ type: 'text', text: 'MOCK_ITERATED_PROMPT' });
    expect(promptService.iteratePrompt).toHaveBeenCalledWith(
      expect.stringContaining('Draft a task handoff prompt.'),
      expect.stringContaining('Draft a task handoff prompt.'),
      expect.stringContaining('Add explicit source boundary and output format.'),
      'mcp-default',
      'iterate-default',
      {
        variables: expect.objectContaining({
          xcCallerSystem: 'hermes',
          xcSourceRefs: expect.stringContaining('id=wiki-2')
        })
      }
    );
  });

  it('registers tools and executes generate-wiki-prompt with XC context', async () => {
    const { server, handlers } = createFakeServer();
    const { coreServices, promptService, modelManager } = createFakeCoreServices();

    await setupServerHandlers(server, coreServices);

    const listTools = handlers.get(ListToolsRequestSchema.shape.method.value);
    const callTool = handlers.get(CallToolRequestSchema.shape.method.value);

    expect(listTools).toBeDefined();
    expect(callTool).toBeDefined();

    const listed = await listTools!({});
    expect(JSON.stringify(listed)).toContain('generate-wiki-prompt');

    const result = await callTool!({
      params: {
        name: 'generate-wiki-prompt',
        arguments: {
          goal: 'Create a Feishu wiki summary prompt.',
          caller_system: 'feishu',
          wiki_context: {
            scope: 'ops/wiki',
            chunks: ['Only use confirmed wiki content.']
          },
          source_refs: [{ id: 'wiki-1', title: 'SOP' }]
        }
      }
    }) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0]).toEqual({ type: 'text', text: 'MOCK_OPTIMIZED_PROMPT' });
    expect(modelManager.getModel).toHaveBeenCalledWith('mcp-default');
    expect(promptService.optimizePrompt).toHaveBeenCalledWith(expect.objectContaining({
      modelKey: 'mcp-default',
      optimizationMode: 'user',
      templateId: 'userOptimize-default'
    }));
    expect(promptService.optimizePrompt.mock.calls[0][0].targetPrompt).toContain('Create a production-ready prompt for GlobalCloud XiaoC (XC).');
    expect(promptService.optimizePrompt.mock.calls[0][0].targetPrompt).toContain('Caller System: feishu');
    expect(promptService.optimizePrompt.mock.calls[0][0].advancedContext.variables).toEqual(expect.objectContaining({
      xcCallerSystem: 'feishu',
      xcWikiContext: expect.stringContaining('Scope: ops/wiki')
    }));
  });

  it('executes evaluate-prompt-fit and returns text content', async () => {
    const { server, handlers } = createFakeServer();
    const { coreServices, promptService } = createFakeCoreServices();

    await setupServerHandlers(server, coreServices);

    const callTool = handlers.get(CallToolRequestSchema.shape.method.value)!;
    const result = await callTool({
      params: {
        name: 'evaluate-prompt-fit',
        arguments: {
          prompt: 'Summarize confirmed wiki updates.',
          expected_use: 'Feishu embedded prompt',
          caller_system: 'feishu'
        }
      }
    }) as { content: Array<{ type: string; text: string }> };

    expect(result.content[0]).toEqual({ type: 'text', text: '{"score":0.91,"risks":[]}' });
    expect(promptService.testPrompt).toHaveBeenCalledWith(
      expect.stringContaining('wiki-driven prompt engineering evaluator'),
      expect.stringContaining('Feishu embedded prompt'),
      'mcp-default'
    );
  });

  it('returns an error for unknown tools without calling prompt services', async () => {
    const { server, handlers } = createFakeServer();
    const { coreServices, promptService } = createFakeCoreServices();

    await setupServerHandlers(server, coreServices);

    const callTool = handlers.get(CallToolRequestSchema.shape.method.value)!;
    const result = await callTool({
      params: {
        name: 'unknown-tool',
        arguments: {}
      }
    }) as { isError: boolean; content: Array<{ type: string; text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Unknown tool 'unknown-tool'");
    expect(promptService.optimizePrompt).not.toHaveBeenCalled();
    expect(promptService.iteratePrompt).not.toHaveBeenCalled();
    expect(promptService.testPrompt).not.toHaveBeenCalled();
  });

  it('returns parameter errors for missing iterate requirements', async () => {
    const { server, handlers } = createFakeServer();
    const { coreServices, promptService } = createFakeCoreServices();

    await setupServerHandlers(server, coreServices);

    const callTool = handlers.get(CallToolRequestSchema.shape.method.value)!;
    const result = await callTool({
      params: {
        name: 'iterate-prompt',
        arguments: {
          prompt: 'Improve this prompt.'
        }
      }
    }) as { isError: boolean; content: Array<{ type: string; text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Missing required parameter 'requirements'");
    expect(promptService.iteratePrompt).not.toHaveBeenCalled();
  });

  it('returns validation errors for invalid XC context before model execution', async () => {
    const { server, handlers } = createFakeServer();
    const { coreServices, modelManager, promptService } = createFakeCoreServices();

    await setupServerHandlers(server, coreServices);

    const callTool = handlers.get(CallToolRequestSchema.shape.method.value)!;
    const result = await callTool({
      params: {
        name: 'optimize-user-prompt',
        arguments: {
          prompt: 'Summarize this.',
          caller_system: 'not-a-supported-system'
        }
      }
    }) as { isError: boolean; content: Array<{ type: string; text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('caller_system must be one of');
    expect(modelManager.getModel).not.toHaveBeenCalled();
    expect(promptService.optimizePrompt).not.toHaveBeenCalled();
  });

  it('returns a model configuration error when the MCP default model is disabled', async () => {
    const { server, handlers } = createFakeServer();
    const { coreServices, modelManager, promptService } = createFakeCoreServices({ modelEnabled: false });

    await setupServerHandlers(server, coreServices);

    const callTool = handlers.get(CallToolRequestSchema.shape.method.value)!;
    const result = await callTool({
      params: {
        name: 'generate-wiki-prompt',
        arguments: {
          goal: 'Create a prompt from wiki rules.'
        }
      }
    }) as { isError: boolean; content: Array<{ type: string; text: string }> };

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('MCP default model is not configured or not enabled');
    expect(modelManager.getModel).toHaveBeenCalledWith('mcp-default');
    expect(promptService.optimizePrompt).not.toHaveBeenCalled();
  });
});
