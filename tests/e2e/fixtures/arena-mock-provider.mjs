// Local deterministic acceptance fixture. No credentials or paid upstream calls.
import { createServer } from 'node:http'
const records = []
let active = 0
let peak = 0
createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  const json = data => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(data)) }
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return }
  if (req.url === '/records') { json({ records, active, peak }); return }
  if (req.url?.endsWith('/models')) { json({ data: ['gpt-4o-mini', 'gpt-4o', 'arena-fail'].map(id => ({ id, object: 'model' })) }); return }
  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) { res.statusCode = 404; json({ error: 'Unknown fixture path' }); return }
  let body = ''
  for await (const chunk of req) body += chunk
  const request = JSON.parse(body)
  records.push({ model: request.model, temperature: request.temperature, stream: request.stream,
    imageCount: request.messages.reduce((n, m) => n + (Array.isArray(m.content) ? m.content.filter(p => p.type === 'image_url').length : 0), 0) })
  if (request.model === 'arena-fail') { res.statusCode = 400; json({ error: { message: 'Local fixture failure' } }); return }
  active++; peak = Math.max(peak, active)
  let closed = false
  res.on('close', () => { closed = true; active-- })
  const content = `Local acceptance fixture · ${request.model}\n\nTemperature: ${request.temperature ?? 'inherited'}\n\nThis deterministic response verifies the shared output path.\n\n\`\`\`html\n<!doctype html><html><body><h1>Arena fixture</h1><p>Same input, independent model columns.</p></body></html>\n\`\`\``
  if (!request.stream) { json({ id: 'fixture', choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }] }); return }
  res.setHeader('Content-Type', 'text/event-stream')
  for (let i = 0; i < content.length; i += 32) {
    if (closed) return
    res.write(`data: ${JSON.stringify({ id: 'fixture', choices: [{ index: 0, delta: { content: content.slice(i, i + 32) }, finish_reason: null }] })}\n\n`)
    await new Promise(resolve => setTimeout(resolve, 160))
  }
  res.write('data: [DONE]\n\n'); res.end()
}).listen(Number(process.env.ARENA_FIXTURE_PORT || 18383), '127.0.0.1', () => console.log('Arena local fixture ready'))
