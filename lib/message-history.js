import { normalizeMessage } from './message-contract.js'

export async function appendMessage(store, raw, options = {}) {
  const message = raw.messageId ? raw : normalizeMessage(raw, options)
  if (!message.messageId || !message.chatId) return null
  await store.mutate(data => { data.messages[message.messageId] = message })
  return message
}

export function getMessage(store, id) {
  return id ? store.read().messages[id] || null : null
}

export function listRecent(store, chatId, limit = 15) {
  return Object.values(store.read().messages).filter(item => item.chatId === chatId).sort((a, b) => a.timestamp - b.timestamp).slice(-Math.max(1, Math.min(50, limit)))
}

export function buildContext(store, chatId, options = {}) {
  const limit = Math.min(15, Math.max(1, options.limit || 15))
  const recent = listRecent(store, chatId, limit)
  const byId = store.read().messages
  const result = []
  const seen = new Set()
  for (const item of recent) {
    if (seen.has(item.messageId)) continue
    seen.add(item.messageId)
    result.push(item)
    let parent = item.quotedId
    let hops = 0
    while (parent && hops < 2) {
      const quoted = byId[parent]
      if (!quoted) break
      if (seen.has(parent)) {
        const existing = result.find(entry => entry.messageId === parent)
        if (existing) existing.contextRole = 'quoted'
        break
      }
      seen.add(parent)
      result.unshift({ ...quoted, contextRole: 'quoted' })
      parent = quoted.quotedId
      hops++
    }
  }
  return result.slice(-25)
}
