let handler = async (m, { conn, isAdmin, isROwner, isOwner, command }) => {
  if (!m.isGroup) return m.reply('❌ للمجموعات فقط')
  if (!isAdmin && !isROwner && !isOwner) return m.reply('❌ للأدمن فقط')

  global.db.data.chats ||= {}
  const chats = global.db.data.chats
  const chat = chats[m.chat] ||= {}
  const cmd = String(command || '').toLowerCase()

  if (cmd === 'يورو_ايقاف' || cmd === 'yoru_off') {
    chat.humanAI = false
  } else if (cmd === 'يورو_تفعيل' || cmd === 'تفعيل_يورو' || cmd === 'yoru_on') {
    chat.humanAI = true
  } else {
    // الأمر العام human_ai يبقى مفتاح تبديل.
    chat.humanAI = !chat.humanAI
  }

  await global.db.write()

  await conn.sendMessage(m.chat, {
    text: chat.humanAI
      ? `✅ *تم تفعيل يورو*\n\nسترد فقط عند منشنها أو الرد على رسالتها`
      : `❌ *تم إيقاف وضع الإنسان الذكي*`,
  }, { quoted: m })
}

handler.help = ['يورو_تفعيل', 'يورو_ايقاف']
handler.tags = ['ai']
handler.command = /^(يورو_تفعيل|يورو_ايقاف|human_ai|تفعيل_يورو|yoru_on|yoru_off)$/i
handler.group = true

export default handler
