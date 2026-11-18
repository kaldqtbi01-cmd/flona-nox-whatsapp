import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'

const clip = (value, max = 300) => String(value || '').slice(0, max)

export function createEventEngine() {
  const listeners = new Map()
  return {
    on(type, listener) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(listener); return () => listeners.get(type)?.delete(listener) },
    async emit(type, payload = {}) { for (const listener of listeners.get(type) || []) await listener(payload) },
    types() { return [...listeners.keys()] },
  }
}

export function createRecoveryManager({ maxAttempts = 2 } = {}) {
  const states = new Map()
  return {
    async run(name, operation) {
      let attempts = 0; let lastError
      while (attempts <= maxAttempts) {
        attempts++
        try { const result = await operation(); states.set(name, { status: 'healthy', attempts, at: Date.now() }); return result }
        catch (error) { lastError = error; states.set(name, { status: 'degraded', attempts, error: clip(error.message), at: Date.now() }) }
      }
      states.set(name, { status: 'failed', attempts, error: clip(lastError?.message), at: Date.now() })
      throw lastError
    },
    status() { return Object.fromEntries(states) },
  }
}

export async function scanPluginIntegrity(pluginsDir, previous = {}) {
  const entries = {}
  let names = []
  try { names = (await fs.readdir(pluginsDir)).filter(name => name.endsWith('.js')).sort() } catch { return { entries, changed: [], missing: Object.keys(previous) } }
  for (const name of names) {
    const content = await fs.readFile(path.join(pluginsDir, name))
    entries[name] = crypto.createHash('sha256').update(content).digest('hex')
  }
  const changed = names.filter(name => previous[name] && previous[name] !== entries[name])
  const missing = Object.keys(previous).filter(name => !entries[name])
  return { entries, changed, missing }
}

export function createAutonomousOS({ core, store, nexus, security } = {}) {
  const events = createEventEngine(); const recovery = createRecoveryManager(); const tasks = new Map()
  return {
    events, recovery,
    async submit({ scope, owner, request, context = '' }) {
      if (!request) throw new Error('طلب المهمة فارغ')
      const id = `os_${Date.now().toString(36)}`
      tasks.set(id, { id, scope, owner, request: clip(request, 1200), status: 'queued', createdAt: Date.now() })
      await events.emit('task.queued', { id, scope, owner })
      const result = await recovery.run(`task:${id}`, async () => {
        tasks.get(id).status = 'running'; await events.emit('task.running', { id })
        const output = await nexus.runSwarm({ scope, owner, request, context, maxAgents: 3, timeoutMs: 15_000 })
        tasks.get(id).status = 'completed'; tasks.get(id).result = output.summary; await events.emit('task.completed', { id })
        return output
      })
      return { id, ...result }
    },
    listTasks() { return [...tasks.values()].slice(-100) },
    async inspect(input) { return security?.record ? security.record(input) : { safe: true, findings: [] } },
    health() { return { tasks: [...tasks.values()].slice(-20), recovery: recovery.status(), eventTypes: events.types(), at: Date.now() } },
  }
}
