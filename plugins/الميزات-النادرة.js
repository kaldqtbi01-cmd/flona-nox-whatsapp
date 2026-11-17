import { listRecent, buildContext } from '../lib/message-history.js'
import { listAudit, appendAudit } from '../lib/audit.js'
import { createDraft, listPending, transition, editDraft } from '../lib/approval-outbox.js'
import { detectModeration, fingerprint } from '../lib/moderation-policy.js'
import { normalizeMessage } from '../lib/message-contract.js'

function store() { return global.featureStore }
function owner(m) { return Boolean(m.isROwner || m.isOwner || m.fromMe) }
function admin(m) { return owner(m) || Boolean(m.isAdmin) }
function argsOf(m) { return String(m.text || '').trim().split(/\s+/).slice(1) }

const handler = async (m, { usedPrefix = '.', command }) => {
  if (!store()) return m.reply('مخزن الميزات غير مهيأ بعد.')
  const args = argsOf(m)
  if (command === 'حالة_الذكاء') {
    const status = global.aiProviders?.status?.() || {}
    const row = (name, item) => `${name}: ${item?.configured ? 'مضبوط' : 'غير مضبوط'} (${item?.model || 'بدون نموذج'})`
    return m.reply(`حالة طبقة AI الموحدة\n${row('Groq', status.groq)}\n${row('Gemini', status.gemini)}\nالتوجيه: النص عبر Groq، والصور/المستندات عبر Gemini، مع fallback محدود.`)
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

handler.help = ['حالة_الميزات', 'حالة_الذكاء', 'سياق', 'سجل_التدقيق', 'مراجعة', 'موافقة', 'رفض', 'تعديل_الرد', 'دفاع']
handler.tags = ['tools', 'owner', 'group']
handler.command = /^(حالة_الميزات|حالة_الذكاء|سياق|سجل_التدقيق|مراجعة|موافقة|رفض|تعديل_الرد|دفاع)$/i

export default handler
