import { afterEach, describe, expect, it, vi } from 'vitest';

import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import express from 'express';

import {
  createHttpSecurityMiddleware,
  HttpSessionRegistry,
  type HttpSecurityConfig
} from '../src/http-security.js';

const defaultConfig: HttpSecurityConfig = {
  httpHost: '127.0.0.1',
  httpAuthToken: 'test-token-with-sufficient-length',
  httpAllowedOrigins: ['https://client.example'],
  httpBodyLimitBytes: 256 * 1024,
  httpMaxSessions: 2,
  httpSessionTtlMs: 30 * 60 * 1000
};

async function startSecurityServer(
  overrides: Partial<HttpSecurityConfig> = {}
): Promise<{ server: Server; url: string }> {
  const app = express();
  app.use('/mcp', createHttpSecurityMiddleware({ ...defaultConfig, ...overrides }));
  app.all('/mcp', (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const server = await new Promise<Server>((resolve) => {
    const httpServer = app.listen(0, '127.0.0.1', () => resolve(httpServer));
  });

  const { port } = server.address() as AddressInfo;
  return { server, url: `http://127.0.0.1:${port}/mcp` };
}

async function stopServer(server: Server | undefined): Promise<void> {
  if (!server) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
}

describe('MCP HTTP security middleware', () => {
  let server: Server | undefined;

  afterEach(async () => {
    await stopServer(server);
    server = undefined;
  });

  it('rejects a request without the configured bearer token', async () => {
    const running = await startSecurityServer();
    server = running.server;

    const response = await fetch(running.url, { method: 'POST' });
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(response.headers.get('www-authenticate')).toBe('Bearer');
    expect(body).not.toContain(defaultConfig.httpAuthToken!);
  });

  it('rejects an incorrect bearer token without exposing either token', async () => {
    const running = await startSecurityServer();
    server = running.server;

    const response = await fetch(running.url, {
      method: 'POST',
      headers: { authorization: 'Bearer incorrect-token' }
    });
    const body = await response.text();

    expect(response.status).toBe(401);
    expect(body).not.toContain('incorrect-token');
    expect(body).not.toContain(defaultConfig.httpAuthToken!);
  });

  it('allows an authenticated native client without an Origin header', async () => {
    const running = await startSecurityServer();
    server = running.server;

    const response = await fetch(running.url, {
      method: 'POST',
      headers: { authorization: `Bearer ${defaultConfig.httpAuthToken}` }
    });

    expect(response.status).toBe(200);
  });

  it('rejects a browser origin that is not allowlisted', async () => {
    const running = await startSecurityServer();
    server = running.server;

    const response = await fetch(running.url, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${defaultConfig.httpAuthToken}`,
        origin: 'https://attacker.example'
      }
    });

    expect(response.status).toBe(403);
    expect(response.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers an allowlisted preflight without requiring bearer authentication', async () => {
    const running = await startSecurityServer();
    server = running.server;

    const response = await fetch(running.url, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://client.example',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'authorization,mcp-session-id'
      }
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-origin')).toBe('https://client.example');
    expect(response.headers.get('vary')).toContain('Origin');
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('mcp-session-id');
    expect(response.headers.get('access-control-allow-headers')?.toLowerCase()).toContain('mcp-protocol-version');
    expect(response.headers.get('access-control-expose-headers')?.toLowerCase()).toContain('mcp-session-id');
  });
});

describe('HttpSessionRegistry', () => {
  type FakeTransport = { close: () => Promise<void> };

  it('counts pending initializations toward the session limit', () => {
    const registry = new HttpSessionRegistry<FakeTransport>(2, 1_000);
    const first = registry.reserve();
    const second = registry.reserve();

    expect(first).toBeDefined();
    expect(second).toBeDefined();
    expect(registry.reserve()).toBeUndefined();

    registry.release(second!);
    expect(registry.reserve()).toBeDefined();
  });

  it('closes and removes sessions after their idle TTL', async () => {
    let now = 0;
    const transport: FakeTransport = { close: vi.fn().mockResolvedValue(undefined) };
    const registry = new HttpSessionRegistry<FakeTransport>(2, 1_000, () => now);
    const reservation = registry.reserve();

    registry.register('session-1', transport, reservation!);
    now = 1_001;

    expect(await registry.cleanupExpired()).toBe(1);
    expect(transport.close).toHaveBeenCalledOnce();
    expect(registry.size).toBe(0);
  });

  it('refreshes the idle deadline when a session is accessed', async () => {
    let now = 0;
    const transport: FakeTransport = { close: vi.fn().mockResolvedValue(undefined) };
    const registry = new HttpSessionRegistry<FakeTransport>(2, 1_000, () => now);
    const reservation = registry.reserve();

    registry.register('session-1', transport, reservation!);
    now = 750;
    expect(registry.get('session-1')).toBe(transport);
    now = 1_500;

    expect(await registry.cleanupExpired()).toBe(0);
    expect(transport.close).not.toHaveBeenCalled();
  });
});
