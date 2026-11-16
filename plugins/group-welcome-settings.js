const handler = async (m, { chat, text, usedPrefix }) => {
  if (!m.isGroup) return m.reply('هذا الإعداد يعمل داخل المجموعات فقط.')
  const input = String(text || '').trim()
  const normalized = input.toLocaleLowerCase()
  if (/^(on|تشغيل|تفعيل|تشغيل_الترحيب)$/.test(normalized)) {
    chat.memberGreetingEnabled = true
    chat.welcome = true
    return m.reply('🌷 تم تشغيل رسائل الترحيب والمغادرة.')
  }
  if (/^(off|ايقاف|إيقاف|تعطيل|إيقاف_الترحيب)$/.test(normalized)) {
    chat.memberGreetingEnabled = false
    chat.welcome = false
    return m.reply('تم إيقاف رسائل الترحيب والمغادرة.')
  }
  const welcome = input.match(/^(?:رسالة\s+)?(?:ترحيب|استقبال)\s+(.+)$/i)
  if (welcome) {
    const template = welcome[1].trim()
    if (!template || template.length > 800) return m.reply('رسالة الترحيب يجب أن تكون بين حرف واحد و800 حرف.')
    chat.sWelcome = template
    chat.memberGreetingEnabled = true
    chat.welcome = true
    return m.reply('✅ تم حفظ رسالة الترحيب وتشغيلها. المتغيرات المتاحة: @user و{group} و{count}.')
  }
  const bye = input.match(/^(?:رسالة\s+)?(?:مغادرة|وداع)\s+(.+)$/i)
  if (bye) {
    const template = bye[1].trim()
    if (!template || template.length > 800) return m.reply('رسالة المغادرة يجب أن تكون بين حرف واحد و800 حرف.')
    chat.sBye = template
    chat.memberGreetingEnabled = true
    chat.welcome = true
    return m.reply('✅ تم حفظ رسالة المغادرة وتشغيلها. المتغيرات المتاحة: @user و{group} و{count}.')
  }
  return m.reply(`🌷 *إعداد الترحيب والمغادرة*\n\n${usedPrefix}ترحيب on — تشغيل\n${usedPrefix}ترحيب off — إيقاف\n${usedPrefix}ترحيب ترحيب أهلًا @user في {group}\n${usedPrefix}ترحيب مغادرة إلى اللقاء @user\n\nالمتغيرات: @user و{group} و{count}`)
}

handler.help = ['ترحيب on/off', 'ترحيب ترحيب <رسالة>', 'ترحيب مغادرة <رسالة>']
handler.tags = ['group']
handler.command = /^(ترحيب|استقبال|رسائل_الترحيب)$/i
handler.group = true
handler.admin = true
export default handler
