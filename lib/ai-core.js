import crypto from 'node:crypto'
import { createAIProviders } from './ai-providers.js'

function boundedText(value, max = 4000) { return String(value ?? '').slice(0, max) }
function keyOf(value) { return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex') }

export function createAICache({ ttlMs = 5 * 60_000, maxEntries = 200, now = () => Date.now() } = {}) {
  const entries = new Map()
  return {
    get(key) {
      const item = entries.get(key)
      if (!item || item.expiresAt <= now()) { entries.delete(key); return undefined }
      return item.value
    },
    set(key, value, ttl = ttlMs) {
      if (entries.size >= maxEntries && !entries.has(key)) entries.delete(entries.keys().next().value)
      entries.set(key, { value, expiresAt: now() + Math.max(1, ttl) })
      return value
    },
    clear() { entries.clear() },
    size() { return entries.size },
  }
}

export function createPromptManager(initial = {}) {
  const prompts = new Map(Object.entries(initial))
  return {
    set(name, template) { if (!name || typeof template !== 'string') throw new Error('قالب غير صالح'); prompts.set(String(name), template); return template },
    get(name, fallback = '') { return prompts.get(String(name)) ?? fallback },
    render(name, variables = {}, fallback = '') {
      return this.get(name, fallback).replace(/\{([a-zA-Z0-9_.-]+)\}/g, (_, path) => path.split('.').reduce((value, part) => value?.[part], variables) ?? '')
    },
    list() { return [...prompts.keys()] },
  }
}

export function createUsageMonitor({ now = () => Date.now(), rates = {} } = {}) {
  const records = []
  return {
    record({ provider, task = 'unknown', inputTokens = 0, outputTokens = 0, success = true } = {}) {
      const input = Math.max(0, Number(inputTokens) || 0); const output = Math.max(0, Number(outputTokens) || 0)
      const cost = (input / 1_000_000) * Number(rates[provider]?.input || 0) + (output / 1_000_000) * Number(rates[provider]?.output || 0)
      records.push({ at: now(), provider, task, inputTokens: input, outputTokens: output, cost, success: Boolean(success) })
      if (records.length > 500) records.splice(0, records.length - 500)
      return records.at(-1)
    },
    summary() { return records.reduce((out, row) => { const key = row.provider || 'unknown'; out[key] ||= { requests: 0, failures: 0, tokens: 0, estimatedCost: 0 }; out[key].requests++; out[key].failures += row.success ? 0 : 1; out[key].tokens += row.inputTokens + row.outputTokens; out[key].estimatedCost += row.cost; return out }, {}) },
    recent(limit = 20) { return records.slice(-Math.max(1, Math.min(100, limit))) },
  }
}

export function createPermissions() {
  return Object.freeze({
    can(actor = {}, action = 'read', context = {}) {
      if (actor.isROwner || actor.isOwner || actor.fromMe) return true
      if (action === 'read') return true
      if (context.isGroup && action === 'moderate') return Boolean(actor.isAdmin)
      return false
    },
  })
}

export function createHealthMonitor({ now = () => Date.now() } = {}) {
  const state = new Map()
  return {
    record(provider, ok, error = '') { state.set(provider, { ok: Boolean(ok), at: now(), error: ok ? '' : boundedText(error, 200) }) },
    status() { return Object.fromEntries(state) },
    isHealthy(provider) { return state.get(provider)?.ok === true },
  }
}

export function createTaskScheduler({ maxTasks = 100, setTimeoutImpl = setTimeout, clearTimeoutImpl = clearTimeout } = {}) {
  const tasks = new Map()
  return {
    schedule(id, fn, delayMs = 0) {
      if (tasks.size >= maxTasks) throw new Error('تم بلوغ حد المهام المجدولة')
      if (!id || typeof fn !== 'function') throw new Error('مهمة جدولة غير صالحة')
      const key = String(id); if (tasks.has(key)) throw new Error('المهمة موجودة مسبقًا')
      const timer = setTimeoutImpl(async () => { tasks.delete(key); await fn() }, Math.max(0, Math.min(24 * 60 * 60_000, Number(delayMs) || 0)))
      tasks.set(key, timer); return key
    },
    cancel(id) { const timer = tasks.get(String(id)); if (!timer) return false; clearTimeoutImpl(timer); tasks.delete(String(id)); return true },
    list() { return [...tasks.keys()] },
  }
}

export function createAICore(options = {}) {
  const providers = options.providers || createAIProviders(options)
  const cache = options.cache || createAICache()
  const prompts = options.prompts || createPromptManager()
  const usage = options.usage || createUsageMonitor()
  const health = options.health || createHealthMonitor()
  const permissions = options.permissions || createPermissions()
  const scheduler = options.scheduler || createTaskScheduler()
  return Object.freeze({
    providers, cache, prompts, usage, health, permissions, scheduler,
    async ask(request = {}) {
      const cacheKey = keyOf({ task: request.task, input: request.input, messages: request.messages, systemInstruction: request.systemInstruction })
      const cached = cache.get(cacheKey); if (cached) return { ...cached, cached: true }
      const started = Date.now()
      try {
        const result = await providers.ask(request)
        usage.record({ provider: result.provider, task: request.task, inputTokens: 0, outputTokens: result.text?.length || 0, success: true })
        health.record(result.provider, true)
        const value = { ...result, latencyMs: Date.now() - started }
        cache.set(cacheKey, value)
        return value
      } catch (error) {
        health.record('router', false, error.message)
        usage.record({ provider: 'router', task: request.task, success: false })
        throw error
      }
    },
    prompt(name, variables, fallback) { return boundedText(prompts.render(name, variables, fallback)) },
  })
}

export const aiCore = createAICore()
export default aiCore
