import crypto from 'node:crypto'

const clip = (value, max = 1600) => String(value || '').trim().slice(0, max)
const taskId = () => `nexus_${Date.now().toString(36)}_${crypto.randomBytes(4).toString('hex')}`
const wait = ms => new Promise(resolve => setTimeout(resolve, ms))
const ROLES = Object.freeze(['ORCHESTRATOR', 'RESEARCH', 'ANALYST', 'CODER', 'SECURITY', 'CREATIVE', 'REVIEWER', 'EXECUTOR'])

export const PERSONAS = Object.freeze({
  FLONA: { name: 'FLONA', role: 'مساعدة رقمية عامة', modelTask: 'chat', permissions: ['answer', 'summarize'] },
  NOVA: { name: 'NOVA', role: 'باحثة ومحللة معلومات', modelTask: 'research', permissions: ['answer', 'summarize'] },
  ATHENA: { name: 'ATHENA', role: 'خبيرة تقنية وبرمجة', modelTask: 'coding', permissions: ['answer', 'draft'] },
  SENTINEL: { name: 'SENTINEL', role: 'خبيرة أمن وحماية', modelTask: 'security', permissions: ['answer', 'inspect'] },
  CREATOR: { name: 'CREATOR', role: 'متخصصة إبداع وتصميم', modelTask: 'creative', permissions: ['answer', 'draft'] },
  ORACLE: { name: 'ORACLE', role: 'تحليل وتخطيط', modelTask: 'planning', permissions: ['answer', 'summarize'] },
})

function nexusData(data) { data.nexus ||= { tasks: {}, events: [], personas: {}, settings: { enabled: true } }; return data.nexus }

export function createNexusCore({ core, store, security } = {}) {
  if (!core || !store) throw new Error('Nexus Core يحتاج AI Core ومخزن الميزات')
  const metrics = { started: 0, completed: 0, failed: 0, recovered: 0, active: 0, failures: [] }
  const recordFailure = error => {
    const now = Date.now()
    metrics.failures.push({ at: now, error: clip(error?.message, 180) })
    metrics.failures = metrics.failures.filter(item => now - item.at <= 15 * 60_000).slice(-50)
  }
  const retryable = error => /HTTP (408|425|429|5\d\d)|انتهت مهلة|timeout/i.test(error?.message || '')
  const ask = async (role, request, context) => {
    const input = `أنت وكيل ${role} داخل FLONA NEXUS. قدم تحليلًا نصيًا فقط، ولا تنفذ أوامر ولا ترسل رسائل.\nالمهمة: ${clip(request, 1200)}\nالسياق: ${clip(context, 1800)}`
    let lastError
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const result = await core.ask({ task: 'chat', input, maxTokens: 500 })
        if (attempt > 0) metrics.recovered += 1
        return result
      } catch (error) {
        lastError = error
        recordFailure(error)
        if (attempt === 0 && retryable(error)) await wait(150)
        else break
      }
    }
    throw lastError
  }
  const log = async (event) => store.mutate(data => { const n = nexusData(data); n.events.push({ ...event, at: Date.now() }); if (n.events.length > 1000) n.events.splice(0, n.events.length - 1000) })

  return {
    roles: ROLES,
    personas: PERSONAS,
    async runSwarm({ scope, owner, request, context = '', roles = ['RESEARCH', 'ANALYST', 'SECURITY'], maxAgents = 4, timeoutMs = 20_000 }) {
      const requested = [...new Set(roles.filter(role => ROLES.includes(role) && role !== 'EXECUTOR'))]
      const adaptiveLimit = String(request || '').length > 500 ? 4 : String(request || '').length > 120 ? 3 : 2
      const selected = requested.slice(0, Math.max(1, Math.min(maxAgents, adaptiveLimit, 4)))
      if (!selected.length) selected.push('RESEARCH')
      const id = taskId(); const started = Date.now(); metrics.started += 1; metrics.active += 1
      await store.mutate(data => { nexusData(data).tasks[id] = { id, scope, owner, request: clip(request, 1200), status: 'running', agents: selected, startedAt: started } })
      await log({ type: 'swarm.started', taskId: id, scope, owner, agents: selected })
      try {
        const results = await Promise.race([
          Promise.all(selected.map(async role => { const result = await ask(role, request, context); return { role, text: clip(result.text), provider: result.provider } })),
          new Promise((_, reject) => setTimeout(() => reject(new Error('انتهت مهلة السرب')), timeoutMs)),
        ])
        const review = await ask('REVIEWER', `راجع النتائج واكتب خلاصة دون تنفيذ:\n${results.map(item => `${item.role}: ${item.text}`).join('\n')}`, context)
        const output = { taskId: id, results, summary: clip(review.text, 2000), status: 'completed', durationMs: Date.now() - started }
        metrics.completed += 1; metrics.active = Math.max(0, metrics.active - 1)
        await store.mutate(data => { nexusData(data).tasks[id] = { ...nexusData(data).tasks[id], ...output, finishedAt: Date.now() } })
        await log({ type: 'swarm.completed', taskId: id, scope, owner, durationMs: output.durationMs })
        return output
      } catch (error) {
        metrics.failed += 1; metrics.active = Math.max(0, metrics.active - 1); recordFailure(error)
        await store.mutate(data => { if (nexusData(data).tasks[id]) nexusData(data).tasks[id].status = 'failed' })
        await log({ type: 'swarm.failed', taskId: id, scope, owner, error: clip(error.message, 200) })
        throw error
      }
    },
    listTasks({ scope, owner, limit = 20 } = {}) { return Object.values(nexusData(store.read()).tasks).filter(item => (!scope || item.scope === scope) && (!owner || item.owner === owner)).slice(-Math.min(50, Math.max(1, Number(limit) || 20))) },
    listEvents(limit = 20) { return nexusData(store.read()).events.slice(-Math.min(100, Math.max(1, Number(limit) || 20))) },
    persona(name) { return PERSONAS[String(name || '').toUpperCase()] || PERSONAS.FLONA },
    setPersona(owner, name, enabled = true) { return store.mutate(data => { nexusData(data).personas[owner] = { owner, persona: this.persona(name).name, enabled: Boolean(enabled), updatedAt: Date.now() } }) },
    status() {
      const data = nexusData(store.read())
      const total = metrics.completed + metrics.failed
      return {
        enabled: data.settings?.enabled !== false,
        tasks: Object.keys(data.tasks).length,
        events: data.events.length,
        personas: Object.keys(data.personas).length,
        roles: ROLES.length,
        health: { active: metrics.active, recentFailures: metrics.failures.length, recovered: metrics.recovered, successRate: total ? Math.round((metrics.completed / total) * 100) : 100 },
      }
    },
    securityScan(input) { return security?.inspect?.(input) || { safe: true, findings: [] } },
  }
}
