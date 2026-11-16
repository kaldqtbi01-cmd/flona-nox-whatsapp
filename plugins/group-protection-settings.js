const handler = async (m, { chat, text, usedPrefix }) => {
  if (!m.isGroup) return m.reply('إعدادات الحماية متاحة داخل المجموعة فقط.')
  const parts = String(text || '').trim().split(/\s+/).filter(Boolean)
  const setting = (parts[0] || '').toLocaleLowerCase()
  const value = (parts[1] || '').toLocaleLowerCase()
  const enabled = /^(on|تشغيل|تفعيل|نعم)$/.test(value)
  const disabled = /^(off|ايقاف|إيقاف|تعطيل|لا)$/.test(value)
  if (/^(روابط|الروابط|antilink)$/.test(setting) && (enabled || disabled)) {
    chat.antilink = enabled
    return m.reply(`🔗 تم ${enabled ? 'تشغيل' : 'إيقاف'} حماية روابط المجموعات.`)
  }
  if (/^(سبام|السبام|antispam)$/.test(setting) && (enabled || disabled)) {
    chat.antiSpam = enabled
    return m.reply(`🛡️ تم ${enabled ? 'تشغيل' : 'إيقاف'} حماية السبام لهذه المجموعة.`)
  }
  if (/^(حد_السبام|حد|limit)$/.test(setting)) {
    const threshold = Number(parts[1])
    if (!Number.isInteger(threshold) || threshold < 5 || threshold > 20) return m.reply('حدد عدد الرسائل بين 5 و20 خلال نافذة قصيرة.')
    chat.antiSpamLimit = threshold
    chat.antiSpam = true
    return m.reply(`تم ضبط حد السبام على ${threshold} رسائل، والحماية مفعّلة.`)
  }
  return m.reply(`🛡️ *إعدادات حماية المجموعة*\n\n${usedPrefix}إعداد_الحماية روابط on/off\n${usedPrefix}إعداد_الحماية سبام on/off\n${usedPrefix}إعداد_الحماية حد_السبام 5-20`)
}
handler.help = ['إعداد_الحماية روابط on/off', 'إعداد_الحماية سبام on/off', 'إعداد_الحماية حد_السبام <5-20>']
handler.tags = ['group']
handler.command = /^(إعداد_الحماية|اعداد_الحماية|حماية_المجموعة)$/i
handler.group = true
handler.admin = true
export default handler
