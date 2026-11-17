import crypto from 'node:crypto'

const allowed = {
  pending: new Set(['approved', 'rejected', 'cancelled']),
  approved: new Set(['sending', 'cancelled']),
  sending: new Set(['sent', 'failed']),
  failed: new Set(['approved', 'cancelled']),
  rejected: new Set(),
  sent: new Set(),
  cancelled: new Set(),
}

export async function createDraft(store, draft) {
  const id = draft.id || crypto.randomUUID()
  const item = { id, status: 'pending', revision: 1, attempts: 0, createdAt: Date.now(), ...draft }
  await store.mutate(data => { data.approvals[id] = item })
  return item
}

export function listPending(store) {
  return Object.values(store.read().approvals).filter(item => item.status === 'pending').sort((a, b) => a.createdAt - b.createdAt)
}

export async function transition(store, id, next, actor, expectedRevision) {
  let result
  await store.mutate(data => {
    const item = data.approvals[id]
    if (!item) throw new Error('draft not found')
    if (expectedRevision !== undefined && item.revision !== expectedRevision) throw new Error('stale revision')
    if (!allowed[item.status]?.has(next)) throw new Error(`invalid transition ${item.status} -> ${next}`)
    item.status = next
    item.revision++
    item.updatedAt = Date.now()
    item.lastActor = actor || 'system'
    result = { ...item }
  })
  return result
}

export async function editDraft(store, id, body, actor, expectedRevision) {
  let result
  await store.mutate(data => {
    const item = data.approvals[id]
    if (!item || item.status !== 'pending') throw new Error('only pending drafts can be edited')
    if (expectedRevision !== undefined && item.revision !== expectedRevision) throw new Error('stale revision')
    item.body = String(body).slice(0, 10000)
    item.revision++
    item.lastActor = actor || 'system'
    item.updatedAt = Date.now()
    result = { ...item }
  })
  return result
}
