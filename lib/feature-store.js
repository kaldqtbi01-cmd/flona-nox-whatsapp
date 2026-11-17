const defaults = {
  version: 1,
  messages: {},
  memories: {},
  audit: [],
  approvals: {},
  workflows: {},
  workflowRuns: [],
  inbox: { contacts: {}, conversations: {}, assignments: {}, notes: {} },
  moderation: { settings: {}, strikes: {}, fingerprints: {} },
}

function ensure(db) {
  db.data ||= {}
  for (const [key, value] of Object.entries(defaults)) {
    if (db.data[key] === undefined) db.data[key] = structuredClone(value)
  }
  db.data.featureStoreVersion = Math.max(1, Number(db.data.featureStoreVersion || 1))
  return db.data
}

export function initFeatureStore(db) {
  ensure(db)
  let write = Promise.resolve()
  const mutate = async (fn) => {
    write = write.then(async () => {
      const data = ensure(db)
      const result = await fn(data)
      await db.write()
      return result
    })
    return write
  }
  const read = () => ensure(db)
  return { read, mutate, ensure: () => ensure(db) }
}

export function pruneFeatureStore(data, now = Date.now(), maxMessages = 2000, maxAudit = 2000) {
  const messages = Object.values(data.messages || {}).sort((a, b) => a.timestamp - b.timestamp)
  if (messages.length > maxMessages) {
    for (const item of messages.slice(0, messages.length - maxMessages)) delete data.messages[item.messageId]
  }
  if (Array.isArray(data.audit) && data.audit.length > maxAudit) data.audit = data.audit.slice(-maxAudit)
  for (const [id, approval] of Object.entries(data.approvals || {})) {
    if (approval.expiresAt && approval.expiresAt < now && ['pending', 'approved'].includes(approval.status)) approval.status = 'cancelled'
  }
  return data
}
