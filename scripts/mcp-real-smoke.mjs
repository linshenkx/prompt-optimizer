#!/usr/bin/env node

import { spawn } from 'node:child_process'
import { setTimeout as delay } from 'node:timers/promises'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

const provider = process.env.MCP_DEFAULT_MODEL_PROVIDER || 'deepseek'
const port = Number(process.env.MCP_REAL_SMOKE_PORT || 3397)

function resolveProviderEnv() {
  if (process.env.VITE_DEEPSEEK_API_KEY) {
    return { keyName: 'VITE_DEEPSEEK_API_KEY', value: process.env.VITE_DEEPSEEK_API_KEY }
  }

  if (process.env.DEEPSEEK_API_KEY) {
    return { keyName: 'DEEPSEEK_API_KEY', value: process.env.DEEPSEEK_API_KEY }
  }

  if (process.env.VITE_OPENAI_API_KEY) {
    return { keyName: 'VITE_OPENAI_API_KEY', value: process.env.VITE_OPENAI_API_KEY }
  }

  if (process.env.OPENAI_API_KEY) {
    return { keyName: 'OPENAI_API_KEY', value: process.env.OPENAI_API_KEY }
  }

  return null
}

function redact(text, secret) {
  if (!secret) return text
  return String(text).replaceAll(secret, '[REDACTED]')
}

async function waitForHealth(baseUrl, child, secret, getLogs) {
  const deadline = Date.now() + Number(process.env.MCP_REAL_SMOKE_HEALTH_TIMEOUT_MS || 30000)

  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`MCP server exited early with code ${child.exitCode}: ${redact(getLogs(), secret).slice(-1200)}`)
    }

    try {
      const response = await fetch(`${baseUrl}/healthz`)
      if (response.ok) return await response.json()
    } catch {
      // Server may still be starting.
    }

    await delay(500)
  }

  throw new Error(`Timed out waiting for MCP healthz: ${redact(getLogs(), secret).slice(-1200)}`)
}

async function main() {
  const providerEnv = resolveProviderEnv()
  if (!providerEnv?.value?.trim()) {
    console.log(JSON.stringify({
      ok: false,
      stage: 'preflight',
      error: 'No supported API key environment variable is set',
      expectedAnyOf: ['VITE_DEEPSEEK_API_KEY', 'DEEPSEEK_API_KEY', 'VITE_OPENAI_API_KEY', 'OPENAI_API_KEY']
    }, null, 2))
    process.exit(2)
  }

  const env = {
    ...process.env,
    MCP_DEFAULT_MODEL_PROVIDER: provider,
    MCP_LOG_LEVEL: process.env.MCP_LOG_LEVEL || 'error',
    MCP_HTTP_PORT: String(port),
  }

  if (providerEnv.keyName === 'DEEPSEEK_API_KEY') {
    env.VITE_DEEPSEEK_API_KEY = providerEnv.value
  }

  if (providerEnv.keyName === 'OPENAI_API_KEY') {
    env.VITE_OPENAI_API_KEY = providerEnv.value
  }

  const child = spawn(process.execPath, [
    '-r',
    './preload-env.cjs',
    'dist/start.cjs',
    '--transport=http',
    `--port=${port}`
  ], {
    cwd: 'packages/mcp-server',
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  })

  let stdout = ''
  let stderr = ''
  child.stdout.on('data', (chunk) => { stdout += String(chunk) })
  child.stderr.on('data', (chunk) => { stderr += String(chunk) })
  const logs = () => `${stdout}\n${stderr}`

  let client
  try {
    const baseUrl = `http://127.0.0.1:${port}`
    const health = await waitForHealth(baseUrl, child, providerEnv.value, logs)

    client = new Client({ name: 'xc-real-smoke', version: '0.0.1' })
    const transport = new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`))
    await client.connect(transport)

    const tools = await client.listTools()
    const result = await client.callTool({
      name: 'generate-wiki-prompt',
      arguments: {
        goal: 'Generate a concise Feishu wiki summary prompt for confirmed SOP updates.',
        caller_system: 'feishu',
        task_type: 'wiki_summary',
        output_contract: 'Return Chinese bullets with source boundaries.',
        wiki_context: {
          scope: 'smoke/wiki',
          chunks: ['Only summarize confirmed SOP updates. Do not invent missing source facts.']
        },
        source_refs: [{ id: 'smoke-sop-1', title: 'Confirmed SOP updates' }]
      }
    })

    const text = result?.content?.find?.((item) => item.type === 'text')?.text || ''
    const ok = Boolean(text && text.length > 20)

    console.log(JSON.stringify({
      ok,
      stage: 'callTool',
      provider,
      keySource: providerEnv.keyName,
      healthStatus: health.status,
      tools: tools.tools?.map((tool) => tool.name) || [],
      textLength: text.length,
      textPreview: text.slice(0, 160)
    }, null, 2))

    if (!ok) process.exitCode = 1
  } catch (error) {
    console.log(JSON.stringify({
      ok: false,
      stage: 'callTool',
      provider,
      keySource: providerEnv.keyName,
      error: redact(error?.message || error, providerEnv.value),
      serverLogTail: redact(logs(), providerEnv.value).slice(-1600)
    }, null, 2))
    process.exitCode = 1
  } finally {
    try {
      await client?.close?.()
    } catch {
      // Best-effort cleanup.
    }
    child.kill('SIGTERM')
    await delay(500)
    if (child.exitCode === null) child.kill('SIGKILL')
  }
}

await main()
