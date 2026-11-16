const userSpamData = new Map()
const WINDOW_MS = 5_000

const handler = m => m
handler.before = async function (m, { conn, isAdmin, isBotAdmin, isOwner, isROwner, isPrems }) {
  if (!m?.isGroup || !m.sender) return
  const chat = global.db?.data?.chats?.[m.chat] || {}
  const botSettings = global.db?.data?.settings?.[conn.user?.jid] || {}
  const enabled = chat.antiSpam === true || (chat.antiSpam !== false && botSettings.antiSpam === true)
  if (!enabled || chat.modoadmin) return
  if (isOwner || isROwner || isAdmin || isPrems) return

  const now = Date.now()
  const key = `${m.chat}:${m.sender}`
  const limit = Math.max(5, Math.min(20, Number(chat.antiSpamLimit) || 8))
  let state = userSpamData.get(key)
  if (!state || now - state.windowStart > WINDOW_MS) {
    state = { windowStart: now, count: 0, strikes: state && now - state.lastStrike < 60_000 ? state.strikes : 0, lastStrike: state?.lastStrike || 0 }
    userSpamData.set(key, state)
  }
  state.count++
  if (state.count < limit) return

  state.count = 0
  state.strikes++
  state.lastStrike = now
  if (userSpamData.size > 2_000) {
    for (const [id, value] of userSpamData) if (now - value.windowStart > 60_000) userSpamData.delete(id)
  }

  if (isBotAdmin && m.key?.id) {
    await conn.sendMessage(m.chat, {
      delete: { remoteJid: m.chat, fromMe: false, id: m.key.id, participant: m.key.participant || m.sender }
    }).catch(() => {})
  }

  const mention = `@${m.sender.split('@')[0]}`
  if (state.strikes < 3) {
    await conn.reply(m.chat, `⚠️ تنبيه ${state.strikes}/3 لـ ${mention}: خفّف الرسائل المتتابعة.`, m, { mentions: [m.sender] }).catch(() => {})
    return
  }

  if (isBotAdmin) {
    await conn.reply(m.chat, `⛔ تم إخراج ${mention} بعد تكرار السبام ثلاث مرات.`, m, { mentions: [m.sender] }).catch(() => {})
    try {
      await conn.groupParticipantsUpdate(m.chat, [m.sender], 'remove')
      userSpamData.delete(key)
    } catch (error) {
      console.error('[antispam] تعذر إخراج العضو:', error?.message || error)
    }
  } else {
    await conn.reply(m.chat, `⚠️ تجاوز ${mention} حد السبام، لكن أحتاج صلاحية مشرف لحذف رسائله أو إخراجه.`, m, { mentions: [m.sender] }).catch(() => {})
    state.strikes = 0
  }
}

export default handler
