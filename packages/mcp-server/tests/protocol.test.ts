import { describe, expect, it } from 'vitest';

import { requestOptions, startProtocolHarness } from './helpers/protocol.js';

describe.each(['stdio-default', 'stdio', 'http'] as const)('MCP %s protocol', mode => {
  it('discovers tools and composes real tool calls with a local mock provider', async () => {
    const harness = await startProtocolHarness(mode);
    const { client, requests, protocolErrors } = harness;

    try {
      // connect() performs initialize + notifications/initialized using the real SDK.
      expect(client.getServerVersion()?.name).toBe('prompt-optimizer-mcp-server');
      expect(client.getServerCapabilities()?.tools).toBeDefined();
      const { tools } = await client.listTools(undefined, requestOptions);
      expect(tools.map(tool => tool.name).sort()).toEqual([
        'iterate-prompt', 'optimize-system-prompt', 'optimize-user-prompt'
      ]);
      expect(requests).toHaveLength(0);

      const templates = new Map<string, { default: string; alternate: string }>();
      for (const tool of tools) {
        const required = tool.name === 'iterate-prompt' ? ['prompt', 'requirements'] : ['prompt'];
        expect(tool.inputSchema.type).toBe('object');
        expect(tool.inputSchema.required).toEqual(required);
        for (const property of required) {
          expect(tool.inputSchema.properties?.[property]).toMatchObject({ type: 'string' });
        }
        const template = tool.inputSchema.properties?.template as {
          type: string; enum: string[]; default: string
        };
        expect(template.type).toBe('string');
        expect(template.enum).toContain(template.default);
        const alternate = template.enum.find(id => id !== template.default);
        expect(alternate).toBeDefined();
        templates.set(tool.name, { default: template.default, alternate: alternate! });
      }

      async function call(name: string, args: Record<string, string>) {
        const count = requests.length;
        const result = await client.callTool({ name, arguments: args }, undefined, requestOptions);
        expect(result.isError).not.toBe(true);
        expect(result.content).toEqual([{ type: 'text', text: `Mock optimized prompt ${count + 1}` }]);
        expect(requests).toHaveLength(count + 1);
        const request = requests[count];
        expect(request).toMatchObject({
          path: '/v1/chat/completions',
          method: 'POST',
          authorization: 'Bearer mock-provider-key',
          body: { model: 'mcp-protocol-test' }
        });
        expect(request.body.stream).not.toBe(true);
        expect(JSON.stringify(request.body.messages)).toContain(args.prompt);
        if (args.requirements) expect(JSON.stringify(request.body.messages)).toContain(args.requirements);
        return { text: `Mock optimized prompt ${count + 1}`, messages: request.body.messages };
      }

      const userArgs = { prompt: 'Explain how a rainbow forms to a curious child.' };
      const user = await call('optimize-user-prompt', userArgs);
      const systemArgs = { prompt: 'You are a patient science tutor. Give short, accurate explanations.' };
      const system = await call('optimize-system-prompt', systemArgs);
      // A caller supplies the previous text explicitly; no UI session or history identifier is needed.
      const iterateArgs = { prompt: user.text, requirements: 'Add one everyday example.' };
      const iteration = await call('iterate-prompt', iterateArgs);

      for (const [name, args, previous] of [
        ['optimize-user-prompt', userArgs, user],
        ['optimize-system-prompt', systemArgs, system],
        ['iterate-prompt', iterateArgs, iteration]
      ] as const) {
        const explicitDefault = await call(name, { ...args, template: templates.get(name)!.default });
        expect(explicitDefault.messages).toEqual(previous.messages);
        const explicit = await call(name, { ...args, template: templates.get(name)!.alternate });
        // A nondefault template must reach the provider, not be silently ignored by the tool handler.
        expect(explicit.messages).not.toEqual(previous.messages);
      }

      const requestCount = requests.length;
      for (const [name, args, message] of [
        ['optimize-user-prompt', {}, "Missing required parameter 'prompt'"],
        ['optimize-system-prompt', { prompt: '   ' }, 'Prompt must be a non-empty string'],
        ['optimize-user-prompt', { prompt: 'x'.repeat(50_001) }, 'Prompt must not exceed 50,000 characters'],
        ['iterate-prompt', { prompt: user.text }, "Missing required parameter 'requirements'"],
        ['iterate-prompt', { prompt: user.text, requirements: '   ' }, 'Requirements must be a non-empty string'],
        ['iterate-prompt', { prompt: user.text, requirements: 'x'.repeat(10_001) }, 'Requirements must not exceed 10,000 characters'],
        ['optimize-user-prompt', { prompt: userArgs.prompt, template: '   ' }, 'Template must be a non-empty string'],
        ['unknown-tool', { prompt: userArgs.prompt }, "Unknown tool 'unknown-tool'"]
      ] as const) {
        const result = await client.callTool({ name, arguments: args }, undefined, requestOptions);
        expect(result.isError).toBe(true);
        expect(result.content).toEqual([{ type: 'text', text: expect.stringContaining(message) }]);
        expect(requests).toHaveLength(requestCount);
      }
    } finally {
      await harness.close();
    }

    // SDK clients may report stray stdout diagnostics yet still complete a handshake.
    // Assert after shutdown too: every stdout line must remain a valid MCP message.
    expect(protocolErrors).toEqual([]);
  }, 30_000);
});
