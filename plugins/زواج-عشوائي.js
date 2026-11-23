const participantId = participant => participant?.id || participant?.jid || participant?.phoneNumber || ''

const handler = async (m, { conn, groupMetadata }) => {
  const botId = conn.decodeJid?.(conn.user?.id || '') || conn.user?.id || ''
  const people = [...new Set((groupMetadata?.participants || [])
    .map(participantId)
    .filter(id => id && id !== botId && !id.endsWith('@g.us')))]

  if (people.length < 2) {
    return m.reply('يحتاج الأمر إلى عضوين على الأقل غير البوت في المجموعة.')
  }

  const firstIndex = Math.floor(Math.random() * people.length)
  const first = people.splice(firstIndex, 1)[0]
  const second = people[Math.floor(Math.random() * people.length)]

  return conn.sendMessage(m.chat, {
    text: `💐 ثنائي عشوائي للمرح فقط:\n@${first.split('@')[0]} و @${second.split('@')[0]}`,
    mentions: [first, second]
  }, { quoted: m })
}

handler.help = ['زواج']
handler.tags = ['games']
handler.command = /^(زواج)$/i
handler.group = true

export default handler
