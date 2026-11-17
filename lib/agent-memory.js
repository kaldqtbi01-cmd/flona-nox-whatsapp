import crypto from 'node:crypto'
import { buildContext } from './message-history.js'
import { createDraft } from './approval-outbox.js'

const limitText = (value, max = 1200) => String(value || '').trim().slice(0, max)
const id = (prefix) => `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`

function ensureMemory(data) {
  data.memories ||= {}
  return data.memories
}

export async function remember(store, { scope, owner, text, kind = 'fact', source = 'user' } = {}) {
  if (!scope || !owner || !text) throw new Error('بيانات الذاكرة ناقصة')
  const item = { id: id('mem'), scope: String(scope), owner: String(owner), text: limitText(text), kind: limitText(kind, 40), source: limitText(source, 40), createdAt: Date.now(), updatedAt: Date.now() }
  await store.mutate(data => { ensureMemory(data)[item.id] = item })
  return item
}

export function listMemories(store, { scope, owner, limit = 20 } = {}) {
  return Object.values(ensureMemory(store.read())).filter(item => item.scope === String(scope) && item.owner === String(owner)).sort((a, b) => a.createdAt - b.createdAt).slice(-Math.max(1, Math.min(100, Number(limit) || 20)))
}

export function searchMemories(store, { scope, owner, query, limit = 10 } = {}) {
  const needle = String(query || '').toLocaleLowerCase()
  return listMemories(store, { scope, owner, limit: 100 }).filter(item => !needle || item.text.toLocaleLowerCase().includes(needle) || item.kind.toLocaleLowerCase().includes(needle)).slice(-Math.max(1, Math.min(50, Number(limit) || 10)))
}

export async function forgetMemory(store, { scope, owner, memoryId } = {}) {
  let removed = false
  await store.mutate(data => { const memories = ensureMemory(data); const item = memories[memoryId]; if (item && item.scope === String(scope) && item.owner === String(owner)) { delete memories[memoryId]; removed = true } })
  return removed
}

export function reconstructContext(store, { chatId, owner, limit = 10 } = {}) {
  const messages = buildContext(store, chatId, { limit })
  const memories = listMemories(store, { scope: chatId, owner, limit: 20 })
  return { messages, memories }
}

function safePlan(plan) {
  if (!plan || typeof plan !== 'object' || !Array.isArray(plan.steps)) throw new Error('خطة الوكيل غير صالحة')
  if (plan.steps.length > 8) throw new Error('الخطة تتجاوز الحد المسموح')
  const allowed = new Set(['answer', 'summarize', 'remember', 'draft'])
  return { goal: limitText(plan.goal, 300), steps: plan.steps.map(step => ({ action: allowed.has(step.action) ? step.action : 'answer', input: limitText(step.input, 1000) })) }
}

export function createAgentEngine({ core, store }) {
  if (!core || !store) throw new Error('محرك الوكيل يحتاج AI Core ومخزن الميزات')
  return {
    async plan({ request, context }) {
      const prompt = `أنت مخطط آمن. أنشئ JSON فقط بالشكل {"goal":"...","steps":[{"action":"answer|summarize|remember|draft","input":"..."}]} دون أوامر نظام أو HTTP أو حذف أو إرسال. الطلب: ${limitText(request, 1000)}\nالسياق: ${limitText(JSON.stringify(context), 3000)}`
      const result = await core.ask({ task: 'chat', input: prompt, fallback: true, maxTokens: 700 })
      try { return safePlan(JSON.parse(result.text.match(/\{[\s\S]*\}/)?.[0] || '')) } catch { return { goal: limitText(request, 300), steps: [{ action: 'answer', input: limitText(request, 1000) }] } }
    },
    async execute({ plan, scope, owner, context }) {
      const safe = safePlan(plan); const outputs = []
      for (const step of safe.steps) {
        if (step.action === 'remember') { outputs.push(await remember(store, { scope, owner, text: step.input, source: 'agent' })); continue }
        if (step.action === 'draft') { outputs.push(await createDraft(store, { chatId: scope, body: step.input, createdBy: owner, metadata: { source: 'agent' } })); continue }
        const task = step.action === 'summarize' ? 'لخص السياق التالي باختصار: ' : ''
        const result = await core.ask({ task: 'chat', input: `${task}${step.input}\n${limitText(JSON.stringify(context), 3000)}` })
        outputs.push({ action: step.action, text: limitText(result.text, 2000), provider: result.provider })
      }
      return outputs
    },
  }
}
