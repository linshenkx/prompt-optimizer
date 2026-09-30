import { spawn, type ChildProcess } from 'node:child_process';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { fileURLToPath } from 'node:url';

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export const requestOptions = { timeout: 5_000 };

type ProviderRequest = {
  path?: string;
  method?: string;
  authorization?: string;
  body: { model: string; messages: unknown[]; stream?: boolean };
};

async function listen(server: Server): Promise<number> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      server.off('error', reject);
      resolve();
    });
  });
  return (server.address() as AddressInfo).port;
}

async function stopServer(server: Server): Promise<void> {
  server.closeAllConnections();
  await new Promise<void>((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
  });
}

async function stopProcess(child: ChildProcess | undefined): Promise<void> {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;

  let timer: ReturnType<typeof setTimeout>;
  const exited = new Promise<void>(resolve => child.once('exit', () => resolve()));
  child.kill('SIGTERM');
  try {
    await Promise.race([
      exited,
      new Promise<void>(resolve => {
        timer = setTimeout(() => {
          child.kill('SIGKILL');
          resolve();
        }, 2_000);
      })
    ]);
  } finally {
    clearTimeout(timer!);
  }
}

/** Run the package CLI against a local fake provider, without inherited API keys or .env files. */
export async function startProtocolHarness(mode: 'stdio-default' | 'stdio' | 'http') {
  const directory = await mkdtemp(join(tmpdir(), 'prompt-optimizer-mcp-'));
  const requests: ProviderRequest[] = [];
  const provider = createServer(async (request, response) => {
    try {
      let body = '';
      for await (const chunk of request) body += chunk;
      requests.push({
        path: request.url,
        method: request.method,
        authorization: request.headers.authorization,
        body: JSON.parse(body)
      });
      response.writeHead(200, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({
        id: `mock-${requests.length}`,
        object: 'chat.completion',
        created: 0,
        model: 'mcp-protocol-test',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: `Mock optimized prompt ${requests.length}` },
          finish_reason: 'stop'
        }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
      }));
    } catch {
      response.writeHead(400);
      response.end('Invalid mock provider request');
    }
  });
  const client = new Client({ name: 'prompt-optimizer-protocol-test', version: '1.0.0' });
  const protocolErrors: string[] = [];
  let closing = false;
  client.onerror = error => {
    // The HTTP SDK reports its own intentional SSE abort as an error on close().
    if (closing && mode === 'http' && error.message.startsWith('SSE stream disconnected: AbortError:')) return;
    protocolErrors.push(error.message);
  };
  let child: ChildProcess | undefined;
  let diagnostics = '';
  let transport: StdioClientTransport | StreamableHTTPClientTransport | undefined;
  const capture = (chunk: Buffer) => { diagnostics = (diagnostics + chunk.toString()).slice(-16_000); };

  async function close() {
    closing = true;
    try {
      await client.close();
    } finally {
      await stopProcess(child);
      if (provider.listening) await stopServer(provider);
      await rm(directory, { recursive: true, force: true });
    }
  }

  try {
    const providerPort = await listen(provider);
    const cli = fileURLToPath(new URL('../../bin/prompt-optimizer-mcp.cjs', import.meta.url));
    const env: Record<string, string> = {
      // The SDK otherwise inherits HOME; keep all configuration lookup in the temporary directory.
      HOME: directory,
      USERPROFILE: directory,
      ...(process.env.SYSTEMROOT ? { SYSTEMROOT: process.env.SYSTEMROOT } : {}),
      VITE_CUSTOM_API_KEY: 'mock-provider-key',
      VITE_CUSTOM_API_BASE_URL: `http://127.0.0.1:${providerPort}/v1`,
      VITE_CUSTOM_API_MODEL: 'mcp-protocol-test',
      MCP_DEFAULT_MODEL_PROVIDER: 'custom',
      MCP_DEFAULT_LANGUAGE: 'en-US',
      MCP_LOG_LEVEL: 'error'
    };

    if (mode !== 'http') {
      transport = new StdioClientTransport({
        command: process.execPath,
        args: mode === 'stdio-default' ? [cli] : [cli, '--transport=stdio'],
        cwd: directory, env, stderr: 'pipe'
      });
      transport.stderr?.on('data', capture);
    } else {
      // The CLI requires a nonzero port. Reserve an ephemeral one until immediately before spawn.
      const reservation = createServer();
      const port = await listen(reservation);
      await stopServer(reservation);
      child = spawn(process.execPath, [cli, '--transport=http', `--port=${port}`], {
        cwd: directory, env, stdio: ['ignore', 'pipe', 'pipe']
      });
      child.stdout?.on('data', capture);
      child.stderr?.on('data', capture);
      let spawnError: Error | undefined;
      child.on('error', error => { spawnError = error; });
      const origin = `http://127.0.0.1:${port}`;
      const deadline = Date.now() + 10_000;
      while (true) {
        if (spawnError) throw spawnError;
        if (child.exitCode !== null || child.signalCode !== null) {
          throw new Error('HTTP MCP process exited before becoming ready');
        }
        try {
          const health = await fetch(`${origin}/healthz`, { signal: AbortSignal.timeout(500) });
          const status = await health.json() as { initialized?: boolean };
          if (health.ok && status.initialized) break;
        } catch {
          // The process may still be loading its core services.
        }
        if (Date.now() >= deadline) throw new Error('HTTP MCP server did not become ready');
        await delay(50);
      }
      transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`));
    }

    await client.connect(transport, requestOptions);
    return { client, requests, protocolErrors, close };
  } catch (error) {
    await close();
    throw new Error(`Could not start ${mode} MCP test: ${(error as Error).message}\n${diagnostics}`, { cause: error });
  }
}
