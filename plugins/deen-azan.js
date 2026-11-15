/*
⌁ 𝐍𝐎𝐗 ⌁
𝚆𝙸𝙻𝙻𝙸𝙰𝙼 𝚇 𝚂𝙷𝙰𝙽𝙆𝚂

「 𝐂𝐫𝐞𝐝𝐢𝐭𝐬 𝐛𝐲 𝚆𝙸𝙻𝙻𝙸𝙰𝙼 𝚇 𝚂𝙷𝙰𝙉𝙆𝚂 」
「 لا تحذف الحقوق 🖤 」
𝐍𝐎𝐗 channel
https://whatsapp.com/channel/0029VbCeOCi7tkjC9bGs3U0l
𝙎𝙃𝘼𝙉𝙆𝙎 channel
https://whatsapp.com/channel/0029VbC5LLx6GcGDXZUmHP0y
 📜 𝙏𝙝𝙞𝙨 𝙞𝙨 𝙩𝙝𝙚 𝙍𝙀𝙋𝙊 𝙡𝙞𝙣𝙠 𝙬𝙞𝙩𝙝 𝙖𝙡𝙡 𝙩𝙝𝙚 𝙘𝙤𝙙𝙚𝙨:
⚡ https://github.com/SHANKS-CODE-1/CODE
*/

import axios from 'axios'
import moment from 'moment-timezone'

const TIMEZONE = 'Asia/Aden'
const LOCATION = { latitude: 15.3694, longitude: 44.1910 }
// AlAdhan method 4 (Umm Al-Qura); the API does not list a Yemen-specific method.
const CALCULATION_METHOD = 4
const SCHEDULER_KEY = '__flonaSanaaAzanScheduler'
const VERSE = '﴿ إِنَّ الصَّلَاةَ كَانَتْ عَلَى الْمُؤْمِنِينَ كِتَابًا مَوْقُوتًا ﴾'
const VERSE_REFERENCE = '﴿ سورة النساء: ١٠٣ ﴾'
const PRAYERS = [
  ['الفجر', 'Fajr'],
  ['الظهر', 'Dhuhr'],
  ['العصر', 'Asr'],
  ['المغرب', 'Maghrib'],
  ['العشاء', 'Isha']
]

const state = global[SCHEDULER_KEY] ||= {
  date: '',
  timings: null,
  sent: new Set(),
  running: false,
  timer: null
}

function localNow() {
  return moment().tz(TIMEZONE)
}

function normalizeTime(value) {
  return String(value || '').split(' ')[0].trim()
}

async function getPrayerTimes() {
  const now = localNow()
  const date = now.format('DD-MM-YYYY')

  if (state.date === date && state.timings) {
    return { date, timings: state.timings }
  }

  const url = new URL(`https://api.aladhan.com/v1/timings/${date}`)
  url.searchParams.set('latitude', String(LOCATION.latitude))
  url.searchParams.set('longitude', String(LOCATION.longitude))
  url.searchParams.set('method', String(CALCULATION_METHOD))
  url.searchParams.set('timezonestring', TIMEZONE)

  const { data: response } = await axios.get(url.toString(), { timeout: 15000 })
  if (response?.code !== 200 || !response?.data?.timings) {
    throw new Error('استجابة مواقيت الصلاة غير صالحة')
  }

  state.date = date
  state.timings = response.data.timings
  return { date, timings: state.timings }
}

function getGroupIds(conn) {
  return Object.entries(conn?.chats || {})
    .filter(([id, chat]) => id.endsWith('@g.us') && chat?.isChats !== false)
    .map(([id]) => id)
}

function getActiveConnections() {
  const candidates = [global.conn, ...(Array.isArray(global.conns) ? global.conns : [])]
  return [...new Set(candidates)].filter(conn => {
    if (!conn?.user || typeof conn.sendMessage !== 'function') return false
    if (conn === global.conn && global.stopped && global.stopped !== 'open') return false
    if (conn.ws?.isOpen === false) return false
    if (typeof conn.ws?.readyState === 'number' && conn.ws.readyState !== 1) return false
    return true
  })
}

async function sendPrayerReminder(conn, date, prayerName) {
  for (const groupId of getGroupIds(conn)) {
    // منع التكرار إذا كان البوت الرئيسي والفرعي موجودين في المجموعة نفسها.
    const sentKey = `${date}:${prayerName}:${groupId}`
    if (state.sent.has(sentKey)) continue

    try {
      let metadata
      try {
        metadata = await conn.groupMetadata(groupId)
      } catch (error) {
        console.error(`[أذان صنعاء] تعذر جلب أعضاء المجموعة ${groupId}:`, error.message)
      }

      const selfJid = conn.user?.id
        ? (typeof conn.decodeJid === 'function' ? conn.decodeJid(conn.user.id) : conn.user.id)
        : null
      const mentions = [...new Set((metadata?.participants || [])
        .map(participant => participant.id || participant.jid)
        .filter(jid => typeof jid === 'string' && jid && jid !== selfJid))]
      const mentionText = mentions
        .map(jid => `@${jid.split('@')[0].split(':')[0]}`)
        .join(' ')
      const prefix = mentionText ? `${mentionText}\n\n` : ''
      const text = `${prefix}🕌 حان الآن موعد أذان صلاة *${prayerName}*\n\n${VERSE}\n${VERSE_REFERENCE}\n\n⏰ بتوقيت صنعاء — اليمن`

      await conn.sendMessage(groupId, { text, mentions })
      state.sent.add(sentKey)
    } catch (error) {
      console.error(`[أذان صنعاء] تعذر إرسال تذكير ${prayerName} إلى ${groupId}:`, error.message)
    }
  }
}

async function runScheduler() {
  if (state.running) return
  const connections = getActiveConnections()
  if (!connections.length) return

  state.running = true
  try {
    const now = localNow()
    const today = now.format('DD-MM-YYYY')
    if (state.date !== today) state.sent.clear()

    const { date, timings } = await getPrayerTimes()
    const currentTime = now.format('HH:mm')

    for (const [prayerName, apiKey] of PRAYERS) {
      if (currentTime !== normalizeTime(timings[apiKey])) continue
      for (const conn of connections) {
        await sendPrayerReminder(conn, date, prayerName)
      }
    }
  } catch (error) {
    console.error('[أذان صنعاء] تعذر التحقق من مواقيت الصلاة:', error.message)
  } finally {
    state.running = false
  }
}

function startScheduler() {
  if (state.timer) clearInterval(state.timer)
  state.timer = setInterval(() => {
    runScheduler().catch(error => console.error('[أذان صنعاء]', error.message))
  }, 20000)
  state.timer.unref?.()
}

async function handler(m) {
  try {
    const { timings } = await getPrayerTimes()
    const now = localNow()
    const formatTime = value => normalizeTime(value).replace(/\d/g, digit => '٠١٢٣٤٥٦٧٨٩'[digit])
    const rows = PRAYERS.map(([name, key]) => `🕰️ ${name}: *${formatTime(timings[key])}*`)
    const text = [
      '🕌 *مواقيت الصلاة — صنعاء، اليمن*',
      `📅 ${now.format('YYYY/MM/DD')}`,
      '',
      ...rows,
      '',
      VERSE,
      VERSE_REFERENCE,
      '',
      '⏰ التوقيت المحلي: صنعاء (Asia/Aden)'
    ].join('\n')
    return await m.reply(text)
  } catch (error) {
    console.error('[أذان صنعاء] تعذر عرض المواقيت:', error.message)
    return await m.reply('تعذر جلب مواقيت الصلاة الآن. حاول مرة أخرى بعد قليل.')
  }
}

handler.help = ['أذان']
handler.tags = ['main']
handler.command = /^(?:أذان|اذان)$/i
handler.before = async function () {
  await runScheduler()
}

startScheduler()

export default handler
