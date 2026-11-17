import crypto from 'node:crypto'
import { createDraft } from './approval-outbox.js'

const text = (v, max = 2000) => String(v || '').trim().slice(0, max)
const uid = (prefix) => `${prefix}_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`

function bucket(data, name) { data.ultimate ||= {}; data.ultimate[name] ||= {}; return data.ultimate[name] }

export function createKnowledgeEngine({ store }) {
  return {
    async add({ scope, owner, title, content, source = 'user', tags = [] }) {
      if (!scope || !owner || !title || !content) throw new Error('بيانات المعرفة ناقصة')
      const item = { id: uid('kb'), scope: String(scope), owner: String(owner), title: text(title, 160), content: text(content, 5000), source: text(source, 80), tags: Array.isArray(tags) ? tags.slice(0, 10).map(x => text(x, 40)) : [], createdAt: Date.now(), updatedAt: Date.now() }
      await store.mutate(data => { bucket(data, 'knowledge')[item.id] = item })
      return item
    },
    search({ scope, owner, query, limit = 10 }) {
      const q = String(query || '').toLocaleLowerCase()
      return Object.values(bucket(store.read(), 'knowledge')).filter(item => item.scope === String(scope) && item.owner === String(owner) && (!q || `${item.title} ${item.content} ${item.tags.join(' ')}`.toLocaleLowerCase().includes(q))).slice(-Math.min(50, Math.max(1, Number(limit) || 10)))
    },
    list({ scope, owner, limit = 20 }) { return this.search({ scope, owner, query: '', limit }) },
  }
}

export function createDigitalTwin({ store }) {
  return {
    async set({ owner, field, value }) {
      if (!owner || !field) throw new Error('بيانات الملف ناقصة')
      await store.mutate(data => { const profiles = bucket(data, 'profiles'); profiles[owner] ||= { owner, updatedAt: Date.now() }; profiles[owner].fields ||= {}; profiles[owner].fields[text(field, 80)] = text(value, 500); profiles[owner].updatedAt = Date.now() })
      return this.get(owner)
    },
    get(owner) { return bucket(store.read(), 'profiles')[owner] || { owner, fields: {} } },
  }
}

export function createCouncil({ core }) {
  const roles = ['المحلل', 'الناقد', 'المخطط']
  return {
    async deliberate({ request, context = '' }) {
      const outputs = []
      for (const role of roles) {
        const result = await core.ask({ task: 'chat', input: `أنت ${role} ضمن مجلس وكلاء آمن. حلل الطلب دون تنفيذ أوامر أو إرسال. الطلب: ${text(request, 1200)}\nالسياق: ${text(context, 1800)}`, maxTokens: 500 })
        outputs.push({ role, text: text(result.text, 900), provider: result.provider })
      }
      const synthesis = await core.ask({ task: 'chat', input: `لخص آراء المجلس في إجابة عملية قصيرة، دون تنفيذ إجراء حساس.\n${outputs.map(x => `${x.role}: ${x.text}`).join('\n')}`, maxTokens: 700 })
      return { members: outputs, synthesis: text(synthesis.text, 1800), provider: synthesis.provider }
    },
  }
}

export function createAutomationCenter({ core, store }) {
  return {
    async recommend({ scope, owner, context = '' }) {
      const result = await core.ask({ task: 'chat', input: `اقترح 3 تحسينات آمنة قابلة للمراجعة لهذه المحادثة. لا ترسل ولا تنفذ.\n${text(context, 2500)}`, maxTokens: 500 })
      const item = { id: uid('rec'), scope, owner, text: text(result.text, 1600), status: 'suggested', createdAt: Date.now() }
      await store.mutate(data => { bucket(data, 'recommendations')[item.id] = item })
      return item
    },
    list({ scope, owner, limit = 10 }) { return Object.values(bucket(store.read(), 'recommendations')).filter(x => x.scope === scope && x.owner === owner).slice(-limit) },
  }
}

export function createUltimateEngines({ core, store, audit = [] } = {}) {
  const knowledge = createKnowledgeEngine({ store })
  const twin = createDigitalTwin({ store })
  const council = createCouncil({ core })
  const automation = createAutomationCenter({ core, store })
  return {
    knowledge, twin, council, automation,
    async createApproval({ scope, owner, body }) { return createDraft(store, { chatId: scope, body: text(body, 5000), createdBy: owner, metadata: { source: 'ultimate-engine' } }) },
    status() {
      const data = store.read(); const ultimate = data.ultimate || {}
      return { knowledge: Object.keys(ultimate.knowledge || {}).length, profiles: Object.keys(ultimate.profiles || {}).length, recommendations: Object.keys(ultimate.recommendations || {}).length, audit: Array.isArray(data.audit) ? data.audit.length : audit.length }
    },
  }
}
