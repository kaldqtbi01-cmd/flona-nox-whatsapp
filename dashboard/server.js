import http from 'node:http'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(root, '..')
const port = Number(process.env.FLONA_MATRIX_PORT || 8787)
const token = String(process.env.FLONA_MATRIX_TOKEN || '')

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(JSON.stringify(body))
}
function authorized(req) { return !token || req.headers.authorization === `Bearer ${token}` }
function safeCount(value) { return value && typeof value === 'object' ? Object.keys(value).length : 0 }

async function overview() {
  let db = {}
  try { db = JSON.parse(await fs.readFile(path.join(projectRoot, 'database.json'), 'utf8')) } catch {}
  const feature = db
  return {
    at: Date.now(),
    process: { uptime: Math.round(process.uptime()), memory: process.memoryUsage().rss },
    whatsapp: { managedBy: 'FLONA current Baileys runtime', sessionUntouched: true },
    ai: { groqConfigured: Boolean(process.env.GROQ_API_KEY), geminiConfigured: Boolean(process.env.GEMINI_API_KEY) },
    features: { messages: safeCount(feature.messages), memories: safeCount(feature.memories), approvals: safeCount(feature.approvals), workflows: safeCount(feature.workflows), audit: Array.isArray(feature.audit) ? feature.audit.length : 0 },
    nexus: db.nexus || { tasks: {}, events: [], personas: {} },
    security: { events: Array.isArray(feature.securityEvents) ? feature.securityEvents.length : 0 },
  }
}

const server = http.createServer(async (req, res) => {
  if (!authorized(req)) return json(res, 401, { error: 'unauthorized' })
  const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`)
  if (url.pathname === '/api/overview') return json(res, 200, await overview())
  if (url.pathname === '/api/health') return json(res, 200, { ok: true, at: Date.now() })
  if (url.pathname === '/manus-routes.json') return json(res, 200, { routes: [{ path: '/', title: 'FLONA MATRIX' }] })
  const requested = url.pathname === '/' ? '/index.html' : url.pathname
  const file = path.resolve(root, `.${requested}`)
  if (!file.startsWith(root)) return json(res, 400, { error: 'bad path' })
  try {
    const body = await fs.readFile(file)
    const type = file.endsWith('.html') ? 'text/html' : file.endsWith('.css') ? 'text/css' : 'application/javascript'
    res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'cache-control': 'no-store' }); res.end(body)
  } catch { json(res, 404, { error: 'not found' }) }
})

server.listen(port, '127.0.0.1', () => console.log(`FLONA MATRIX listening on 127.0.0.1:${port}`))
