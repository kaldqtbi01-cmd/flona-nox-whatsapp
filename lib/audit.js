import crypto from 'node:crypto'

const SECRET_KEYS = /token|secret|password|api[-_]?key|authorization|cookie/i
function redact(value, depth = 0) {
  if (depth > 4) return '[truncated]'
  if (typeof value === 'string') return value.length > 2000 ? `${value.slice(0, 2000)}…` : value
  if (Array.isArray(value)) return value.slice(0, 30).map(item => redact(item, depth + 1))
  if (!value || typeof value !== 'object') return value
  return Object.fromEntries(Object.entries(value).slice(0, 50).map(([key, item]) => [key, SECRET_KEYS.test(key) ? '[redacted]' : redact(item, depth + 1)]))
}

export function hashBody(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex')
}

export async function appendAudit(store, event) {
  const item = {
    id: `${Date.now()}-${crypto.randomUUID()}`,
    at: new Date().toISOString(),
    type: String(event.type || 'unknown'),
    actor: String(event.actor || 'system'),
    chatId: event.chatId || null,
    target: event.target || null,
    data: redact(event.data || {}),
  }
  await store.mutate(data => {
    data.audit.push(item)
    if (data.audit.length > 2000) data.audit = data.audit.slice(-2000)
  })
  return item
}

export function listAudit(store, filter = {}) {
  return store.read().audit.filter(item => !filter.type || item.type === filter.type).slice(-(filter.limit || 50)).reverse()
}
