import { listRecent, buildContext } from '../lib/message-history.js'
import { listAudit, appendAudit } from '../lib/audit.js'
import { createDraft, listPending, transition, editDraft } from '../lib/approval-outbox.js'
import { detectModeration, fingerprint } from '../lib/moderation-policy.js'
import { normalizeMessage } from '../lib/message-contract.js'
import { listMemories, searchMemories, remember, forgetMemory, reconstructContext } from '../lib/agent-memory.js'
import { scanPluginIntegrity } from '../lib/nexus-os.js'
import path from 'node:path'

function store() { return global.featureStore }
function owner(m) { return Boolean(m.isROwner || m.isOwner || m.fromMe) }
function admin(m) { return owner(m) || Boolean(m.isAdmin) }
function argsOf(m) { return String(m.text || '').trim().split(/\s+/).slice(1) }

const handler = async (m, { usedPrefix = '.', command }) => {
  if (!store()) return m.reply('مخزن الميزات غير مهيأ بعد.')
  const args = argsOf(m)
  if (command === 'ذاكرة') {
    const mode = args.shift() || 'عرض'
    if (mode === 'حفظ') {
      const text = args.join(' ')
      if (!text) return m.reply(`استخدم: ${usedPrefix}ذاكرة حفظ <معلومة>`)
      await remember(store(), { scope: m.chat, owner: m.sender, text })
      return m.reply('تم حفظ المعلومة في الذاكرة الخاصة بهذه المحادثة.')
    }
    if (mode === 'بحث') {
      const rows = searchMemories(store(), { scope: m.chat, owner: m.sender, query: args.join(' '), limit: 10 })
      return m.reply(rows.length ? rows.map(item => `${item.id}: ${item.text}`).join('\n') : 'لا توجد ذاكرة مطابقة.')
    }
    if (mode === 'حذف') {
      const removed = await forgetMemory(store(), { scope: m.chat, owner: m.sender, memoryId: args[0] })
      return m.reply(removed ? 'تم حذف الذاكرة.' : 'لم أجد ذاكرة بهذا المعرف أو لا تملك صلاحية حذفها.')
    }
    const rows = listMemories(store(), { scope: m.chat, owner: m.sender, limit: Number(args[0]) || 10 })
    return m.reply(rows.length ? rows.map(item => `${item.id}: ${item.text}`).join('\n') : 'لا توجد معلومات محفوظة لهذه المحادثة.')
  }
  if (command === 'إعادة_السياق') {
    const context = reconstructContext(store(), { chatId: m.chat, owner: m.sender, limit: Number(args[0]) || 10 })
    return m.reply(`إعادة بناء السياق\nالرسائل: ${context.messages.length}\nالذكريات: ${context.memories.length}\n${context.memories.map(item => `• ${item.text}`).join('\n')}`)
  }
  if (command === 'وكيل') {
    const request = args.join(' ')
    if (!request) return m.reply(`استخدم: ${usedPrefix}وكيل <المهمة>\nالوكيل لا ينفذ أوامر نظام ولا يرسل تلقائيًا.`)
    if (!global.agentEngine) return m.reply('محرك الوكيل غير مهيأ بعد.')
    try {
      const context = reconstructContext(store(), { chatId: m.chat, owner: m.sender, limit: 10 })
      const plan = await global.agentEngine.plan({ request, context })
      const outputs = await global.agentEngine.execute({ plan, scope: m.chat, owner: m.sender, context })
      const text = outputs.map(item => item?.text || (item?.id ? `مسودة بانتظار الموافقة: ${item.id}` : 'تم تنفيذ الخطوة.')).join('\n')
      return m.reply(`خطة الوكيل: ${plan.goal}\n${text}`.slice(0, 3500))
    } catch (error) { return m.reply(`تعذر تشغيل الوكيل: ${String(error.message || 'خطأ').slice(0, 180)}`) }
  }
  if (command === 'معرفة') {
    const engine = global.ultimateEngines?.knowledge
    if (!engine) return m.reply('محرك المعرفة غير مهيأ بعد.')
    const mode = args.shift() || 'عرض'
    if (mode === 'حفظ') {
      const title = args.shift(); const content = args.join(' ')
      if (!title || !content) return m.reply(`استخدم: ${usedPrefix}معرفة حفظ <العنوان> <المحتوى>`)
      await engine.add({ scope: m.chat, owner: m.sender, title, content })
      return m.reply('تم حفظ المعلومة في قاعدة المعرفة الخاصة بك.')
    }
    const rows = engine.search({ scope: m.chat, owner: m.sender, query: mode === 'بحث' ? args.join(' ') : '', limit: 10 })
    return m.reply(rows.length ? rows.map(item => `${item.id} | ${item.title}: ${item.content}`).join('\n') : 'لا توجد نتائج في قاعدة المعرفة.')
  }
  if (command === 'ملفي') {
    const twin = global.ultimateEngines?.twin
    if (!twin) return m.reply('محرك الملف الشخصي غير مهيأ بعد.')
    if (args[0] === 'حفظ') {
      const field = args[1]; const value = args.slice(2).join(' ')
      if (!field || !value) return m.reply(`استخدم: ${usedPrefix}ملفي حفظ <الحقل> <القيمة>`)
      await twin.set({ owner: m.sender, field, value }); return m.reply('تم تحديث ملفك الشخصي الذكي.')
    }
    const profile = twin.get(m.sender)
    return m.reply(Object.keys(profile.fields || {}).length ? Object.entries(profile.fields).map(([key, value]) => `${key}: ${value}`).join('\n') : 'ملفك الشخصي الذكي فارغ.')
  }
  if (command === 'مجلس') {
    const request = args.join(' ')
    if (!request) return m.reply(`استخدم: ${usedPrefix}مجلس <السؤال>`)
    try { const result = await global.ultimateEngines.council.deliberate({ request, context: JSON.stringify(reconstructContext(store(), { chatId: m.chat, owner: m.sender, limit: 6 })) }); return m.reply(`خلاصة المجلس:\n${result.synthesis}`) }
    catch (error) { return m.reply(`تعذر تشغيل المجلس: ${String(error.message || 'خطأ').slice(0, 180)}`) }
  }
  if (command === 'توصية') {
    try { const result = await global.ultimateEngines.automation.recommend({ scope: m.chat, owner: m.sender, context: JSON.stringify(reconstructContext(store(), { chatId: m.chat, owner: m.sender, limit: 8 })) }); return m.reply(`توصية قابلة للمراجعة:\n${result.text}`) }
    catch (error) { return m.reply(`تعذر إنشاء التوصية: ${String(error.message || 'خطأ').slice(0, 180)}`) }
  }
  if (command === 'مركز_القيادة') {
    const status = global.ultimateEngines?.status?.() || {}
    return m.reply(`FLONA Command Center\nالذكريات: ${Object.keys(store().read().memories || {}).length}\nالمعرفة: ${status.knowledge || 0}\nالملفات الشخصية: ${status.profiles || 0}\nالتوصيات: ${status.recommendations || 0}\nالموافقات المعلقة: ${listPending(store()).length}`)
  }
  if (command === 'صحة_النظام') {
    const health = global.systemHealth?.snapshot?.()
    if (!health) return m.reply('مراقب الصحة غير مهيأ بعد.')
    return m.reply(`صحة FLONA\nGroq: ${health.providers.groq?.configured ? 'مضبوط' : 'غير مضبوط'}\nGemini: ${health.providers.gemini?.configured ? 'مضبوط' : 'غير مضبوط'}\nCache: ${health.cacheEntries}\nالمهام: ${health.scheduledTasks}\nالمحركات: ${health.engines ? 'جاهزة' : 'غير جاهزة'}`)
  }
  if (command === 'أمن') {
    if (!owner(m)) return m.reply('هذا الأمر للمالك فقط.')
    const summary = global.securityCenter?.summary?.(m.chat) || { total: 0, flagged: 0 }
    return m.reply(`مركز استخبارات الحماية\nالأحداث: ${summary.total}\nالمحاولات المصنفة: ${summary.flagged}\nالوضع: تسجيل وتحليل فقط، بدون عقوبة تلقائية.`)
  }
  if (command === 'أتمتة') {
    const control = global.automationControl
    if (!control) return m.reply('مركز الأتمتة غير مهيأ بعد.')
    const mode = args.shift() || 'عرض'
    if (mode === 'اقتراح') {
      try { const item = await control.suggest({ scope: m.chat, owner: m.sender, context: JSON.stringify(reconstructContext(store(), { chatId: m.chat, owner: m.sender, limit: 6 })) }); return m.reply(`تم إنشاء أتمتة للمراجعة: ${item.id}\nالحالة: ${item.status}\n${item.description}`) }
      catch (error) { return m.reply(`تعذر إنشاء الأتمتة: ${String(error.message || 'خطأ').slice(0, 180)}`) }
    }
    const rows = control.list({ scope: m.chat, owner: m.sender })
    return m.reply(rows.length ? rows.map(item => `${item.id} | ${item.status} | ${item.title}`).join('\n') : 'لا توجد أتمتة محفوظة.')
  }
  if (command === 'حالة_النكسس') {
    const status = global.nexusCore?.status?.()
    if (!status) return m.reply('Nexus Core غير مهيأ بعد.')
    const health = status.health || {}
    return m.reply(`FLONA NEXUS\nالحالة: ${status.enabled ? 'مفعلة' : 'متوقفة'}\nالمهام: ${status.tasks}\nالأحداث: ${status.events}\nالشخصيات المستخدمة: ${status.personas}\nالوكلاء: ${status.roles}\nالاستقرار: ${health.successRate ?? 100}%\nالمهام النشطة: ${health.active ?? 0}\nفشل حديث: ${health.recentFailures ?? 0}\nتعافٍ ناجح: ${health.recovered ?? 0}`)
  }
  if (command === 'الشخصية') {
    const nexus = global.nexusCore
    if (!nexus) return m.reply('Nexus Core غير مهيأ بعد.')
    if (args[0] === 'اختيار' && args[1]) { await nexus.setPersona(m.sender, args[1]); return m.reply(`تم اختيار الشخصية: ${nexus.persona(args[1]).name} — ${nexus.persona(args[1]).role}`) }
    const current = store().read().nexus?.personas?.[m.sender]?.persona || 'FLONA'
    return m.reply(`الشخصية الحالية: ${current}\nالمتاح: FLONA, NOVA, ATHENA, SENTINEL, CREATOR, ORACLE\nاستخدم: ${usedPrefix}الشخصية اختيار <الاسم>`)
  }
  if (command === 'سرب') {
    const request = args.join(' ')
    if (!request) return m.reply(`استخدم: ${usedPrefix}سرب <المهمة>`)
    try {
      const context = reconstructContext(store(), { chatId: m.chat, owner: m.sender, limit: 6 })
      const result = await global.nexusCore.runSwarm({ scope: m.chat, owner: m.sender, request, context: JSON.stringify(context) })
      return m.reply(`مهمة السرب ${result.taskId}\n${result.summary}\nالوكلاء: ${result.results.map(item => item.role).join('، ')}`.slice(0, 3500))
    } catch (error) { return m.reply(`تعذر تشغيل السرب: ${String(error.message || 'خطأ').slice(0, 180)}`) }
  }
  if (command === 'مهمة_نكسس') {
    const request = args.join(' ')
    if (!request) return m.reply(`استخدم: ${usedPrefix}مهمة_نكسس <المهمة>`)
    try { const result = await global.nexusOS.submit({ scope: m.chat, owner: m.sender, request, context: JSON.stringify(reconstructContext(store(), { chatId: m.chat, owner: m.sender, limit: 6 })) }); return m.reply(`تمت المهمة ${result.id}\n${result.summary}`.slice(0, 3500)) }
    catch (error) { return m.reply(`تعذر تنفيذ المهمة: ${String(error.message || 'خطأ').slice(0, 180)}`) }
  }
  if (command === 'حالة_التشغيل') {
    const state = global.nexusOS?.health?.()
    return m.reply(state ? `Autonomous OS\nالمهام: ${state.tasks.length}\nأنواع الأحداث: ${state.eventTypes.length}\nحالات الاسترداد: ${Object.keys(state.recovery).length}` : 'Autonomous OS غير مهيأ بعد.')
  }
  if (command === 'أحداث_النكسس') {
    if (!owner(m)) return m.reply('هذا الأمر للمالك فقط.')
    const rows = global.nexusCore?.listEvents?.(Number(args[0]) || 10) || []
    return m.reply(rows.length ? rows.map(row => `${new Date(row.at).toISOString()} | ${row.type} | ${row.taskId || '-'}`).join('\n') : 'لا توجد أحداث Nexus.')
  }
  if (command === 'فحص_الإضافات') {
    if (!owner(m)) return m.reply('هذا الأمر للمالك فقط.')
    const previous = store().read().nexusIntegrity || {}
    const result = await scanPluginIntegrity(path.resolve('plugins'), previous)
    await store().mutate(data => { data.nexusIntegrity = result.entries })
    return m.reply(`فحص الإضافات\nالملفات: ${Object.keys(result.entries).length}\nالمتغيرة: ${result.changed.length}\nالمفقودة: ${result.missing.length}\nالحالة: ${result.changed.length || result.missing.length ? 'تحتاج مراجعة' : 'سليمة'}`)
  }
  if (command === 'حالة_طبقة_AI') {
    const status = global.aiProviders?.status?.() || {}
    const row = (name, item) => `${name}: ${item?.configured ? 'مضبوط' : 'غير مضبوط'} (${item?.model || 'بدون نموذج'})`
    const core = global.aiCore
    const cache = core?.cache?.size?.() ?? 0
    const tasks = core?.scheduler?.list?.()?.length ?? 0
    const queue = core?.limiter?.stats?.() || {}
    return m.reply(`حالة طبقة AI الموحدة\n${row('Groq', status.groq)}\n${row('Gemini', status.gemini)}\nCache: ${cache}\nطابور AI: ${queue.active ?? 0} نشط / ${queue.queued ?? 0} منتظر\nحد التزامن: ${queue.maxConcurrent ?? 2}\nالمهام المجدولة: ${tasks}\nالتوجيه: النص عبر Groq، والصور/المستندات عبر Gemini، مع fallback محدود.`)
  }
  if (command === 'حالة_الميزات') {
    const data = store().read()
    return m.reply(`حالة الميزات المحلية\nالرسائل المحفوظة: ${Object.keys(data.messages).length}\nسجل التدقيق: ${data.audit.length}\nالموافقات المعلقة: ${listPending(store()).length}\nالتدفقات: ${Object.keys(data.workflows).length}`)
  }
  if (command === 'سياق') {
    const context = buildContext(store(), m.chat, { limit: Number(args[0]) || 10 })
    return m.reply(context.length ? context.map((item, i) => `${i + 1}. ${item.contextRole === 'quoted' ? '[مقتبس] ' : ''}${item.text || `[${item.kind}]`}`).join('\n') : 'لا يوجد سياق محفوظ لهذه المحادثة.')
  }
  if (command === 'سجل_التدقيق') {
    if (!owner(m)) return m.reply('هذا الأمر للمالك فقط.')
    const rows = listAudit(store(), { limit: Number(args[0]) || 10 })
    return m.reply(rows.length ? rows.map(row => `${row.at} | ${row.type} | ${row.chatId || '-'}`).join('\n') : 'سجل التدقيق فارغ.')
  }
  if (command === 'مراجعة') {
    if (!owner(m)) return m.reply('هذا الأمر للمالك فقط.')
    const rows = listPending(store())
    return m.reply(rows.length ? rows.map(row => `${row.id}\n${String(row.body || '').slice(0, 300)}\nrevision=${row.revision}`).join('\n\n') : 'لا توجد مسودات معلقة.')
  }
  if (command === 'موافقة' || command === 'رفض') {
    if (!owner(m)) return m.reply('هذا الأمر للمالك فقط.')
    const id = args[0]
    if (!id) return m.reply(`استخدم: ${usedPrefix}${command} <id>`)
    try {
      const next = command === 'موافقة' ? 'approved' : 'rejected'
      await transition(store(), id, next, m.sender)
      await appendAudit(store(), { type: `approval.${next}`, actor: m.sender, chatId: m.chat, target: id })
      return m.reply(`تم ${command === 'موافقة' ? 'اعتماد' : 'رفض'} المسودة. الإرسال التلقائي غير مفعّل.`)
    } catch (error) { return m.reply(`تعذر تحديث المسودة: ${error.message}`) }
  }
  if (command === 'تعديل_الرد') {
    if (!owner(m)) return m.reply('هذا الأمر للمالك فقط.')
    const id = args.shift(); const body = args.join(' ')
    if (!id || !body) return m.reply(`استخدم: ${usedPrefix}تعديل_الرد <id> <النص>`)
    try { await editDraft(store(), id, body, m.sender); return m.reply('تم تعديل المسودة وبقيت بانتظار الموافقة.') }
    catch (error) { return m.reply(`تعذر تعديل المسودة: ${error.message}`) }
  }
  if (command === 'دفاع') {
    if (!m.isGroup) return m.reply('هذا الأمر للمجموعات فقط.')
    if (!admin(m)) return m.reply('هذا الأمر للمشرفين فقط.')
    const mode = args[0]
    const chat = store().read().moderation.settings[m.chat] || {}
    if (mode === 'تشغيل') chat.auditOnly = true
    else if (mode === 'إيقاف') chat.auditOnly = false
    else return m.reply(`الحماية الحالية: ${chat.auditOnly === true ? 'audit-only' : 'معطلة'}\nاستخدم ${usedPrefix}دفاع تشغيل أو ${usedPrefix}دفاع إيقاف`)
    await store().mutate(data => { data.moderation.settings[m.chat] = chat })
    await appendAudit(store(), { type: 'moderation.settings', actor: m.sender, chatId: m.chat, data: { auditOnly: chat.auditOnly } })
    return m.reply(chat.auditOnly ? 'تم تشغيل المراقبة audit-only بدون حذف أو عقوبة.' : 'تم إيقاف المراقبة.')
  }
}

handler.all = async function (m) {
  if (!store() || !m?.isGroup || !m.text) return
  const settings = store().read().moderation.settings[m.chat]
  if (!settings?.auditOnly) return
  const normalized = normalizeMessage(m)
  const state = store().read().moderation.fingerprints[m.chat] || {}
  const result = detectModeration(normalized, { ...settings, antiLink: settings.antiLink === true, antiRepeat: settings.antiRepeat === true, antiSpam: settings.antiSpam === true }, state)
  if (!result.violations.length || state.messageId === normalized.messageId) return
  await store().mutate(data => { data.moderation.fingerprints[m.chat] = { messageId: normalized.messageId, lastFingerprint: result.fingerprint, recentCount: Number(state.recentCount || 0) + 1 } })
  await appendAudit(store(), { type: 'moderation.violation', actor: m.sender, chatId: m.chat, data: { violations: result.violations, fingerprint: fingerprint(m.text) } })
}

handler.help = ['حالة_الميزات', 'حالة_طبقة_AI', 'حالة_النكسس', 'حالة_التشغيل', 'صحة_النظام', 'أمن', 'أتمتة', 'فحص_الإضافات', 'أحداث_النكسس', 'سياق', 'إعادة_السياق', 'ذاكرة', 'وكيل', 'سرب', 'مهمة_نكسس', 'الشخصية', 'معرفة', 'ملفي', 'مجلس', 'توصية', 'مركز_القيادة', 'سجل_التدقيق', 'مراجعة', 'موافقة', 'رفض', 'تعديل_الرد', 'دفاع']
handler.tags = ['tools', 'owner', 'group']
handler.command = /^(حالة_الميزات|حالة_طبقة_AI|حالة_النكسس|حالة_التشغيل|صحة_النظام|أمن|أتمتة|فحص_الإضافات|أحداث_النكسس|سياق|إعادة_السياق|ذاكرة|وكيل|سرب|مهمة_نكسس|الشخصية|معرفة|ملفي|مجلس|توصية|مركز_القيادة|سجل_التدقيق|مراجعة|موافقة|رفض|تعديل_الرد|دفاع)$/i

export default handler
