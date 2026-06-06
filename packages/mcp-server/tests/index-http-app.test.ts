import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Server as HttpServer } from 'node:http';

import { createHttpApp } from '../src/index.js';
import type { CoreServicesManager } from '../src/adapters/core-services.js';
import type { MCPServerConfig } from '../src/config/environment.js';

function createConfig(overrides: Partial<MCPServerConfig> = {}): MCPServerConfig {
  return {
    httpPort: 3001,
    logLevel: 'error',
    defaultLanguage: 'en-US',
    preferredModelProvider: 'deepseek',
    authToken: undefined,
    allowedOrigins: ['https://feishu.example.com'],
    enableDnsRebindingProtection: true,
    ...overrides
  };
}

function createCoreServices(initialized: boolean): CoreServicesManager {
  return {
    getHealthStatus: vi.fn(async () => ({
      initialized,
      services: {
        modelManager: initialized,
        llmService: initialized,
        languageService: initialized,
        templateManager: initialized,
        historyManager: initialized,
        promptService: initialized
      }
    }))
  } as unknown as CoreServicesManager;
}

async function listen(app: ReturnType<typeof createHttpApp>['app']): Promise<{
  baseUrl: string;
  close: () => Promise<void>;
}> {
  const server: HttpServer = await new Promise((resolve) => {
    const started = app.listen(0, () => resolve(started));
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Expected TCP server address');
  }

  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })
  };
}

describe('MCP HTTP app', () => {
  const servers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(close => close()));
    vi.restoreAllMocks();
  });

  it('reports healthy and degraded health states with session counts', async () => {
    const healthy = createHttpApp(createConfig(), createCoreServices(true));
    healthy.transports['session-1'] = { handleRequest: vi.fn() } as never;
    const healthyServer = await listen(healthy.app);
    servers.push(healthyServer.close);

    const healthyResponse = await fetch(`${healthyServer.baseUrl}/healthz`);
    expect(healthyResponse.status).toBe(200);
    await expect(healthyResponse.json()).resolves.toEqual(expect.objectContaining({
      status: 'ok',
      service: 'GlobalCloud XiaoC MCP',
      transport: 'http',
      activeSessions: 1,
      authRequired: false,
      initialized: true
    }));

    const degraded = createHttpApp(createConfig({ authToken: '0123456789abcdef' }), createCoreServices(false));
    const degradedServer = await listen(degraded.app);
    servers.push(degradedServer.close);

    const degradedResponse = await fetch(`${degradedServer.baseUrl}/healthz`);
    expect(degradedResponse.status).toBe(503);
    await expect(degradedResponse.json()).resolves.toEqual(expect.objectContaining({
      status: 'degraded',
      authRequired: true,
      initialized: false
    }));
  });

  it('serves CORS preflight even when auth is configured', async () => {
    const { app } = createHttpApp(createConfig({
      authToken: '0123456789abcdef',
      allowedOrigins: ['https://feishu.example.com', 'https://xgd.example.com']
    }), createCoreServices(true));
    const server = await listen(app);
    servers.push(server.close);

    const response = await fetch(`${server.baseUrl}/mcp`, { method: 'OPTIONS' });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://feishu.example.com');
    expect(response.headers.get('access-control-allow-methods')).toBe('GET, POST, DELETE, OPTIONS');
    expect(response.headers.get('access-control-allow-headers')).toContain('X-XC-MCP-Token');
  });

  it('rejects unauthenticated MCP requests before session validation', async () => {
    const { app } = createHttpApp(createConfig({ authToken: '0123456789abcdef' }), createCoreServices(true));
    const server = await listen(app);
    servers.push(server.close);

    const response = await fetch(`${server.baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: 'Unauthorized',
      message: 'Missing or invalid MCP auth token'
    });
  });

  it('returns clear invalid-session errors for MCP requests without reusable sessions', async () => {
    const { app } = createHttpApp(createConfig(), createCoreServices(true));
    const server = await listen(app);
    servers.push(server.close);

    const post = await fetch(`${server.baseUrl}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 })
    });
    expect(post.status).toBe(400);
    await expect(post.json()).resolves.toEqual({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided'
      },
      id: null
    });

    const get = await fetch(`${server.baseUrl}/mcp`);
    expect(get.status).toBe(400);
    await expect(get.text()).resolves.toBe('Invalid or missing session ID');

    const del = await fetch(`${server.baseUrl}/mcp`, { method: 'DELETE' });
    expect(del.status).toBe(400);
    await expect(del.text()).resolves.toBe('Invalid or missing session ID');
  });

  it('reuses existing transports for POST, GET, and DELETE requests with a known session id', async () => {
    const { app, transports } = createHttpApp(createConfig(), createCoreServices(true));
    const handleRequest = vi.fn(async (_req, res) => {
      res.status(202).json({ handled: true });
    });
    transports['session-1'] = { handleRequest } as never;
    const server = await listen(app);
    servers.push(server.close);

    const headers = { 'mcp-session-id': 'session-1' };
    for (const method of ['POST', 'GET', 'DELETE'] as const) {
      const response = await fetch(`${server.baseUrl}/mcp`, {
        method,
        headers: method === 'POST'
          ? { ...headers, 'content-type': 'application/json' }
          : headers,
        body: method === 'POST' ? JSON.stringify({ jsonrpc: '2.0', method: 'tools/list', id: 1 }) : undefined
      });
      expect(response.status).toBe(202);
      await expect(response.json()).resolves.toEqual({ handled: true });
    }

    expect(handleRequest).toHaveBeenCalledTimes(3);
  });
});
