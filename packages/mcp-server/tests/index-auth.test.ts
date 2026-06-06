import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

import { constantTimeEqual, createMCPAuthMiddleware, extractBearerToken } from '../src/index.js';
import type { MCPServerConfig } from '../src/config/environment.js';

function createConfig(authToken?: string): MCPServerConfig {
  return {
    httpPort: 3001,
    logLevel: 'error',
    defaultLanguage: 'en-US',
    preferredModelProvider: 'deepseek',
    authToken,
    allowedOrigins: ['http://127.0.0.1:3000'],
    enableDnsRebindingProtection: true
  };
}

function createResponse() {
  const res = {
    status: vi.fn(),
    json: vi.fn()
  };
  res.status.mockReturnValue(res);
  return res as unknown as Response & typeof res;
}

function runMiddleware(req: Partial<Request>, authToken?: string) {
  const middleware = createMCPAuthMiddleware(createConfig(authToken));
  const res = createResponse();
  const next = vi.fn() as NextFunction;

  middleware(req as Request, res, next);

  return { res, next };
}

describe('MCP auth helpers', () => {
  it('extracts bearer tokens case-insensitively and rejects malformed headers', () => {
    expect(extractBearerToken()).toBeUndefined();
    expect(extractBearerToken('Bearer abc123')).toBe('abc123');
    expect(extractBearerToken('bearer token-value')).toBe('token-value');
    expect(extractBearerToken('Basic abc123')).toBeUndefined();
    expect(extractBearerToken('Bearer')).toBeUndefined();
  });

  it('compares equal length token candidates without accepting length mismatches', () => {
    expect(constantTimeEqual('secret-token', 'secret-token')).toBe(true);
    expect(constantTimeEqual('secret-token', 'wrong-token')).toBe(false);
    expect(constantTimeEqual('short', 'longer')).toBe(false);
  });

  it('allows requests when auth is disabled or the request is CORS preflight', () => {
    const disabled = runMiddleware({
      method: 'POST',
      headers: {}
    });
    expect(disabled.next).toHaveBeenCalledOnce();
    expect(disabled.res.status).not.toHaveBeenCalled();

    const preflight = runMiddleware({
      method: 'OPTIONS',
      headers: {}
    }, 'secret-token');
    expect(preflight.next).toHaveBeenCalledOnce();
    expect(preflight.res.status).not.toHaveBeenCalled();
  });

  it('accepts bearer tokens and XC token headers', () => {
    const bearer = runMiddleware({
      method: 'POST',
      headers: {
        authorization: 'Bearer secret-token'
      }
    }, 'secret-token');
    expect(bearer.next).toHaveBeenCalledOnce();
    expect(bearer.res.status).not.toHaveBeenCalled();

    const header = runMiddleware({
      method: 'POST',
      headers: {
        'x-xc-mcp-token': 'secret-token'
      }
    }, 'secret-token');
    expect(header.next).toHaveBeenCalledOnce();
    expect(header.res.status).not.toHaveBeenCalled();
  });

  it('rejects missing, malformed, or incorrect auth tokens', () => {
    const missing = runMiddleware({
      method: 'POST',
      headers: {}
    }, 'secret-token');
    expect(missing.next).not.toHaveBeenCalled();
    expect(missing.res.status).toHaveBeenCalledWith(401);
    expect(missing.res.json).toHaveBeenCalledWith({
      error: 'Unauthorized',
      message: 'Missing or invalid MCP auth token'
    });

    const invalid = runMiddleware({
      method: 'POST',
      headers: {
        authorization: 'Bearer wrong-token',
        'x-xc-mcp-token': ['secret-token']
      }
    }, 'secret-token');
    expect(invalid.next).not.toHaveBeenCalled();
    expect(invalid.res.status).toHaveBeenCalledWith(401);
  });
});
