let handler = async (m, { text, command, settings, isOwner }) => {
  if (!isOwner) return m.reply('❌ هذه الميزة للمطور فقط.')
  const value = String(text || '').trim().toLowerCase()
  const on = ['on', 'تشغيل', 'تفعيل'].includes(value)
  const off = ['off', 'إيقاف', 'ايقاف', 'تعطيل'].includes(value)
  if (!on && !off) return m.reply(`🛡️ الاستخدام: .${command} on أو .${command} off`)
  settings.autoViewOnce = on
  return m.reply(`✅ تم ${on ? 'تفعيل' : 'تعطيل'} استخراج وسائط العرض مرة واحدة.`)
}

handler.help = ['مضاد_العرض on/off', 'استخراج_العرض on/off']
handler.tags = ['protection']
handler.command = /^(مضاد_العرض|استخراج_العرض|viewonce_تلقائي)$/i
handler.owner = true

export default handler
