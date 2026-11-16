import { getGameLeaderboard } from '../lib/game-leaderboard.js'

const handler = async (m, { conn }) => {
  if (!m.isGroup) return m.reply('لوحة المتصدرين متاحة داخل المجموعة فقط.')
  const rows = getGameLeaderboard(global.db, m.chat, 10)
  if (!rows.length) return m.reply('لا توجد نقاط مسجلة بعد. شارك في لعبة «تحدي» لتظهر هنا!')
  const mentions = rows.map(row => row.jid)
  const lines = rows.map((row, index) => `${index + 1}. @${row.jid.split('@')[0]} — *${row.points}* نقطة (${row.wins} إجابة صحيحة)`)
  return conn.sendMessage(m.chat, { text: `🏆 *متصدرو ألعاب المجموعة*\n\n${lines.join('\n')}`, mentions }, { quoted: m })
}
handler.help = ['متصدرين', 'نقاط_الألعاب']
handler.tags = ['games']
handler.command = /^(متصدرين|لوحة_الألعاب|نقاط_الألعاب|ترتيب_الألعاب)$/i
handler.group = true
export default handler
