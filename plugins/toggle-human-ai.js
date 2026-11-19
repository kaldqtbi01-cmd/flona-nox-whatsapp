import { getSoulSettings } from '../lib/flona-soul-engine.js'

let handler = async (m, { conn, isAdmin, isROwner, isOwner, command }) => {
  if (!m.isGroup) return m.reply('❌ للمجموعات فقط')
  if (!isAdmin && !isROwner && !isOwner) return m.reply('❌ للأدمن فقط')

  global.db.data ||= {}
  global.db.data.chats ||= {}
  const chat = global.db.data.chats[m.chat] ||= {}
  const settings = getSoulSettings(chat)
  const cmd = String(command || '').toLowerCase()

  if (cmd === 'يورو_ايقاف' || cmd === 'yoru_off') {
    settings.paused = true
  } else if (cmd === 'يورو_تفعيل' || cmd === 'تفعيل_يورو' || cmd === 'yoru_on') {
    settings.enabled = true
    settings.paused = false
  } else {
    settings.enabled = !settings.enabled
    settings.paused = false
  }

  await global.db.write()
  await conn.sendMessage(m.chat, {
    text: settings.enabled && !settings.paused
      ? `✅ تم تشغيل لوكا\n\nيرد فقط عند منشنه أو الرد على رسالته`
      : settings.paused
        ? `⏸️ تم إيقاف ردود لوكا مؤقتًا مع الاحتفاظ بالإعدادات`
        : `❌ تم إطفاء لوكا في هذه المجموعة`,
  }, { quoted: m })
}

handler.help = ['يورو_تفعيل', 'يورو_ايقاف']
handler.tags = ['ai']
handler.command = /^(يورو_تفعيل|يورو_ايقاف|human_ai|تفعيل_يورو|yoru_on|yoru_off)$/i
handler.group = true

export default handler
