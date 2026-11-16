let handler = async (m, { conn, isAdmin, isBotAdmin }) => {
  if (!m.isGroup) return m.reply('❌ هذا الأمر للمجموعات فقط.')
  if (!isAdmin) return m.reply('❌ هذا الأمر للمشرفين فقط.')
  if (!isBotAdmin) return m.reply('❌ يجب أن يكون البوت مشرفًا.')
  const metadata = await conn.groupMetadata(m.chat)
  const participants = metadata.participants || []
  const mentions = participants.map(p => p.id)
  const text = `📢 منشن جماعي\n\n${mentions.map(jid => `@${jid.split('@')[0]}`).join(' ')}`
  return conn.sendMessage(m.chat, { text, mentions }, { quoted: m })
}
handler.help = ['تاق_الجميع']
handler.tags = ['group']
handler.command = /^(تاق_الجميع|منشن_الجميع)$/i
export default handler
