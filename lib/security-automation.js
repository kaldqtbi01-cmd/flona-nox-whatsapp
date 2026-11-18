const clip = (value, max = 500) => String(value || '').slice(0, max)

const rules = Object.freeze([
  { id: 'secret', pattern: /(gsk_|AIza|AQ\.|Bearer\s+[A-Za-z0-9._-]{12,})/i, label: 'محاولة أو نص حساس' },
  { id: 'code-exec', pattern: /(--?exec|child_process|eval\s*\(|vm\.run|rm\s+-rf)/i, label: 'طلب تنفيذ كود أو أمر' },
  { id: 'prompt-injection', pattern: /(ignore\s+(all|previous)|تجاهل\s+(كل|التعليمات)|اكشف\s+التعليمات|system\s+prompt)/i, label: 'اشتباه حقن تعليمات' },
])

export function createSecurityCenter({ store } = {}) {
  return {
    inspect(input = '') {
      const findings = rules.filter(rule => rule.pattern.test(String(input))).map(rule => ({ id: rule.id, label: rule.label }))
      return { safe: findings.length === 0, findings, redacted: String(input).replace(/(gsk_|AIza|AQ\.|Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]') }
    },
    async record({ scope, actor, input, action = 'inspect' }) {
      const result = this.inspect(input)
      if (store) await store.mutate(data => { data.securityEvents ||= []; data.securityEvents.push({ scope, actor, action, safe: result.safe, findings: result.findings, at: Date.now() }); if (data.securityEvents.length > 500) data.securityEvents.splice(0, data.securityEvents.length - 500) })
      return result
    },
    summary(scope) {
      const rows = store?.read()?.securityEvents || []
      const filtered = scope ? rows.filter(row => row.scope === scope) : rows
      return { total: filtered.length, flagged: filtered.filter(row => !row.safe).length, recent: filtered.slice(-10) }
    },
  }
}

export function createAutomationControl({ core, store }) {
  return {
    async create({ scope, owner, title, description }) {
      const item = { id: `auto_${Date.now().toString(36)}`, scope, owner, title: clip(title, 120), description: clip(description, 800), status: 'draft', createdAt: Date.now() }
      await store.mutate(data => { data.automations ||= {}; data.automations[item.id] = item })
      return item
    },
    list({ scope, owner }) { return Object.values(store.read().automations || {}).filter(item => item.scope === scope && item.owner === owner).slice(-50) },
    async suggest({ scope, owner, context }) {
      const result = await core.ask({ task: 'chat', input: `اقترح أتمتة آمنة بصيغة وصف فقط، بدون تنفيذ أوامر أو إرسال. السياق: ${clip(context, 2000)}`, maxTokens: 450 })
      return this.create({ scope, owner, title: 'اقتراح AI', description: result.text })
    },
    async setStatus({ scope, owner, id, status }) {
      if (!['draft', 'paused', 'review'].includes(status)) throw new Error('حالة أتمتة غير مسموحة')
      let result
      await store.mutate(data => { const item = data.automations?.[id]; if (!item || item.scope !== scope || item.owner !== owner) throw new Error('الأتمتة غير موجودة'); item.status = status; item.updatedAt = Date.now(); result = { ...item } })
      return result
    },
  }
}

export function createSystemHealth({ providers, core, engines }) {
  return {
    snapshot() {
      const providerStatus = providers?.status?.() || {}
      return { providers: providerStatus, cacheEntries: core?.cache?.size?.() || 0, scheduledTasks: core?.scheduler?.list?.()?.length || 0, engines: Boolean(engines), at: Date.now() }
    },
  }
}
