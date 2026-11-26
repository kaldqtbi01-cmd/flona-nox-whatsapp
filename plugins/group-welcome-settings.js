const handler = async (m, { chat, text, usedPrefix, command }) => {
  if (!m.isGroup) return m.reply('هذا الإعداد يعمل داخل المجموعات فقط.')
  const input = String(text || '').trim()
  const normalized = input.toLocaleLowerCase()
  const commandName = String(command || '').toLocaleLowerCase()

  if (commandName === 'ترحيب_تشغيل' || /^(on|تشغيل|تفعيل|تشغيل_الترحيب)$/.test(normalized)) {
    chat.memberGreetingEnabled = true
    chat.welcome = true
    return m.reply('🌷 تم تشغيل رسائل الترحيب والمغادرة في هذه المجموعة.')
  }
  if (commandName === 'ترحيب_ايقاف' || /^(off|ايقاف|إيقاف|تعطيل|إيقاف_الترحيب)$/.test(normalized)) {
    chat.memberGreetingEnabled = false
    chat.welcome = false
    return m.reply('تم إيقاف رسائل الترحيب والمغادرة في هذه المجموعة.')
  }

  const welcome = input.match(/^(?:رسالة\s+)?(?:ترحيب|استقبال)\s+(.+)$/i)
  if (welcome) {
    const template = welcome[1].trim()
    if (!template || template.length > 800) return m.reply('رسالة الترحيب يجب أن تكون بين حرف واحد و800 حرف.')
    chat.sWelcome = template
    chat.memberGreetingEnabled = true
    chat.welcome = true
    return m.reply('✅ تم حفظ رسالة الترحيب وتشغيلها. المتغيرات المتاحة: @العضو و@user و{user} و{group} و{count}.')
  }

  const bye = input.match(/^(?:رسالة\s+)?(?:مغادرة|وداع)\s+(.+)$/i)
  if (bye) {
    const template = bye[1].trim()
    if (!template || template.length > 800) return m.reply('رسالة المغادرة يجب أن تكون بين حرف واحد و800 حرف.')
    chat.sBye = template
    chat.memberGreetingEnabled = true
    chat.welcome = true
    return m.reply('✅ تم حفظ رسالة المغادرة وتشغيلها. المتغيرات المتاحة: @العضو و@user و{user} و{group} و{count}.')
  }

  return m.reply(`🌷 *إعداد الترحيب والمغادرة لكل مجموعة*\n\n${usedPrefix}ترحيب_تشغيل — تشغيل الرسالتين\n${usedPrefix}ترحيب_ايقاف — إيقاف الرسالتين\n${usedPrefix}ترحيب ترحيب <رسالتك> — تخصيص الترحيب\n${usedPrefix}ترحيب وداع <رسالتك> — تخصيص الوداع\n\nالمتغيرات: @العضو و@user و{user} و{group} و{count}`)
}

handler.help = ['ترحيب_تشغيل', 'ترحيب_ايقاف', 'ترحيب ترحيب <رسالة>', 'ترحيب وداع <رسالة>']
handler.tags = ['group']
handler.command = /^(ترحيب_تشغيل|ترحيب_ايقاف|ترحيب|استقبال|رسائل_الترحيب)$/i
handler.group = true
handler.admin = true
export default handler
