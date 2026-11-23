const handler = async (m, { conn, args = [] }) => {
  try {
    const requestedGroup = String(args[0] || '').match(/\d+-\d+@g\.us/)?.[0]
    const groupId = requestedGroup || m.chat

    if (!groupId.endsWith('@g.us')) {
      return m.reply('❌ هذا الأمر يستخدم فقط في المجموعات.')
    }
    if (groupId !== m.chat) {
      return m.reply('❌ استخدم الأمر داخل المجموعة المطلوبة؛ لا يمكن عرض سجل مجموعة أخرى.')
    }

    await conn.sendMessage(m.chat, { react: { text: '🌐', key: m.key } })

    const messages = conn.chats?.[groupId]?.messages || {}
    const participants = new Set()
    for (const message of Object.values(messages)) {
      if (message?.key?.fromMe) continue
      const jid = message?.key?.participant || message?.participant
      if (typeof jid !== 'string' || !/@(?:s\.whatsapp\.net|lid)$/.test(jid)) continue
      participants.add(jid)
    }

    const activeMembers = [...participants].sort((a, b) =>
      a.split('@')[0].localeCompare(b.split('@')[0])
    )
    const onlineList = activeMembers.length
      ? activeMembers.map((jid, index) => `*🐥┆${index + 1}. @${jid.split('@')[0]}*`).join('\n')
      : '*🐦┆✦ لا يوجد أعضاء نشطاء ضمن الرسائل المحفوظة حالياً*'

    const text = `> ꒦꒷𓆩🌐𓆪꒷꒦
> 
> 🜲⃝☠️ *قـائـمـة الأعـضـاء الـنـشـطـاء*
> 👁️⃝🩸 *الأعضاء الظاهرون في آخر الرسائل المحفوظة بذاكرة البوت*
> 
> ${onlineList}
> 
> ꒦꒷𓆩☣️𓆪꒷꒦ ✧ 🩸 𖤐 🜲 ✧ ꒦꒷𓆩☣️𓆪꒷꒦
> 
> 𓆩⧼ 𝑭𝑳𝑶𝑵𝑨 ⧽𓆪`

    await conn.sendMessage(m.chat, {
      text,
      mentions: activeMembers
    }, { quoted: m })
    await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } })
  } catch (error) {
    console.error('[المتصلين]', error?.message || error)
    await m.reply('❌ حدث خطأ أثناء جلب الأعضاء النشطين.')
  }
}

handler.help = ['المتصلين']
handler.tags = ['group']
handler.command = /^(المتصلين|النشطين|active)$/i
handler.group = true

export default handler
