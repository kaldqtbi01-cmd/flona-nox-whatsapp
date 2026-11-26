const badWords = ['كس', 'شرموط', 'قحبة', 'زق', 'نيك', 'منيك']

function enabled(value) {
  return value === true || value === 'on'
}

let handler = async (m, { conn, text, command, settings, chat, isAdmin, isOwner }) => {
  if (!isOwner) return m.reply('❌ هذه إعدادات للمطور فقط.')
  const value = String(text || '').trim().toLowerCase()
  const enableAutoRead = command === 'تلقائي_تشغيل'
  const disableAutoRead = command === 'تلقائي_ايقاف'
  const on = enableAutoRead || (!disableAutoRead && (value === 'on' || value === 'تشغيل' || value === 'تفعيل'))
  const off = disableAutoRead || (!enableAutoRead && (value === 'off' || value === 'إيقاف' || value === 'ايقاف' || value === 'تعطيل'))
  const target = /^(مكالمة_مضادة|مضاد_المكالمات)$/i.test(command) ? 'antiCall' :
    /^(تلقائي_تشغيل|تلقائي_ايقاف|قراءة_تلقائية|قراءة_الرسائل)$/i.test(command) ? 'autoRead' :
    /^(كتابة_تلقائية|حالة_الكتابة)$/i.test(command) ? 'autoTyping' :
    /^(حالة_تلقائية|قراءة_الحالات)$/i.test(command) ? 'autoStatus' :
    /^(مضاد_التاغ|منع_التاغ)$/i.test(command) ? 'antiTag' : 'antiBadword'
  if (!on && !off) return m.reply(`🛡️ الاستخدام: .${command} on أو .${command} off`)
  if (target === 'antiTag' || target === 'antiBadword') {
    if (!m.isGroup) return m.reply('❌ هذا الإعداد للمجموعات فقط.')
    chat[target] = on
  } else {
    settings[target] = on
  }
  if (target === 'autoRead') {
    try { await global.db?.write?.() } catch {}
  }
  const labels = { antiCall: 'منع المكالمات', autoRead: 'القراءة التلقائية', autoTyping: 'حالة الكتابة', autoStatus: 'قراءة الحالات', antiTag: 'منع التاغ', antiBadword: 'منع الكلمات' }
  return m.reply(`✅ تم ${on ? 'تفعيل' : 'تعطيل'}: ${labels[target]}`)
}

handler.all = async function (m, { conn, settings, chat, isAdmin }) {
  if (!m || m.fromMe || !m.key) return
  const chatJid = m.key.remoteJid || m.chat || ''
  if (!chatJid || chatJid === 'status@broadcast' || chatJid.endsWith('@newsletter')) return
  if (enabled(settings?.autoRead)) {
    try { await conn.readMessages([m.key]) } catch {}
  }
  if (m.text && enabled(settings?.autoTyping)) {
    try {
      await conn.presenceSubscribe(m.chat)
      await conn.sendPresenceUpdate('composing', m.chat)
      setTimeout(() => conn.sendPresenceUpdate('paused', m.chat).catch(() => {}), 1500)
    } catch {}
  }
  if (!m.isGroup || isAdmin) return
  const mentioned = m.mentionedJid || m.msg?.contextInfo?.mentionedJid || []
  if (enabled(chat?.antiTag) && mentioned.length >= 4) {
    try { await conn.sendMessage(m.chat, { delete: m.key }) } catch {}
    await conn.sendMessage(m.chat, { text: '🚫 تم حذف التاغ الجماعي.' }).catch(() => {})
    return
  }
  if (enabled(chat?.antiBadword) && badWords.some(word => String(m.text).toLowerCase().includes(word))) {
    try { await conn.sendMessage(m.chat, { delete: m.key }) } catch {}
    await conn.sendMessage(m.chat, { text: '🚫 تم حذف رسالة مخالفة.' }).catch(() => {})
  }
}

handler.help = ['تلقائي_تشغيل', 'تلقائي_ايقاف', 'مكالمة_مضادة on/off', 'قراءة_تلقائية on/off', 'كتابة_تلقائية on/off', 'حالة_تلقائية on/off', 'مضاد_التاغ on/off', 'مضاد_كلمات on/off']
handler.tags = ['protection']
handler.command = /^(تلقائي_تشغيل|تلقائي_ايقاف|مكالمة_مضادة|مضاد_المكالمات|قراءة_تلقائية|قراءة_الرسائل|كتابة_تلقائية|حالة_الكتابة|حالة_تلقائية|قراءة_الحالات|مضاد_التاغ|منع_التاغ|مضاد_كلمات|مضاد_الكلمات)$/i
handler.owner = true

export default handler
