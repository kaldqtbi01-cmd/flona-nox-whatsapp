import { parseModerationDuration } from '../lib/group-moderation.js'
import { getKnownJidVariants, normalizeJid, rememberParticipants } from '../lib/identity.js'

const handler = async (m, { conn, chat, text, participants, usedPrefix }) => {
  if (!m.isGroup) return m.reply('الكتم المؤقت يعمل داخل المجموعات فقط.')
  const target = m.mentionedJid?.[0] || m.quoted?.sender
  if (!target) return m.reply(`منشن العضو أو رد على رسالته.\nمثال: ${usedPrefix}كتم_مؤقت @عضو 10m [السبب]`)
  rememberParticipants(participants || [])
  const targetVariants = new Set([normalizeJid(target), ...getKnownJidVariants(target)].filter(Boolean))
  if (targetVariants.has(normalizeJid(m.sender))) return m.reply('لا يمكنك كتم نفسك.')
  const targetNumber = String(target).split('@')[0].replace(/:\d+$/, '')
  if ([...(global.owner || []), ...(global.ownerLid || [])].some(owner => {
    const value = Array.isArray(owner) ? owner[0] : owner
    const ownerJid = normalizeJid(value)
    return (ownerJid && targetVariants.has(ownerJid)) || String(value || '').replace(/\D/g, '') === targetNumber.replace(/\D/g, '')
  })) {
    return m.reply('لا يمكن كتم مالك البوت.')
  }
  const participant = (participants || []).find(item => [item.id, item.jid, item.lid, item.phoneNumber].some(jid => targetVariants.has(normalizeJid(jid))))
  if (participant?.admin) return m.reply('لا يمكن تطبيق الكتم المؤقت على مشرف في المجموعة.')
  const durationToken = String(text || '').trim().match(/(?:^|\s)([0-9٠-٩]+\s*(?:m|min|mins|minute|minutes|د|دقيقة|دقائق|دقيقه|h|hr|hrs|hour|hours|س|ساعة|ساعات|d|day|days|ي|يوم|أيام|ايام))(?:\s|$)/i)?.[1]
  const durationMs = parseModerationDuration(durationToken)
  const maxDuration = 24 * 60 * 60 * 1000
  if (!durationMs || durationMs > maxDuration) return m.reply('المدة غير صالحة. استخدم مثلًا 10m أو 2h أو 1d (الحد الأقصى 24 ساعة).')
  const until = Date.now() + durationMs
  chat.mutedUsers ||= {}
  for (const variant of targetVariants) chat.mutedUsers[variant] = until
  const reason = String(text || '').replace(durationToken, '').trim()
  const formatted = durationMs >= 3_600_000
    ? `${Math.round(durationMs / 3_600_000)} ساعة`
    : `${Math.round(durationMs / 60_000)} دقيقة`
  return conn.sendMessage(m.chat, {
    text: `🔇 تم تقييد رسائل @${targetNumber} لمدة ${formatted}.${reason ? `\nالسبب: ${reason}` : ''}\nسيحذف البوت رسائله حتى انتهاء المدة.`,
    mentions: [target]
  }, { quoted: m })
}

handler.help = ['كتم_مؤقت @عضو <10m|2h|1d> [سبب]']
handler.tags = ['group']
handler.command = /^(كتم_مؤقت|اسكات_مؤقت|mute_temp)$/i
handler.group = true
handler.admin = true
handler.botAdmin = true
export default handler
