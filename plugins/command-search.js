import { MENU_SECTIONS, getMenuCommands } from '../lib/menu-categories.js'

function normalize(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .toLocaleLowerCase()
    .trim()
}

export function searchMenuCommands(plugins, query, limit = 12) {
  const needle = normalize(query)
  if (!needle) return []
  const found = []
  for (const [id, section] of Object.entries(MENU_SECTIONS)) {
    for (const label of getMenuCommands(plugins, id)) {
      const normalized = normalize(label)
      if (normalized.includes(needle)) found.push({ section: section.title, icon: section.icon, label })
    }
  }
  return found.slice(0, Math.max(1, Math.min(30, Number(limit) || 12)))
}

async function handler(m, { text, usedPrefix }) {
  const query = String(text || '').trim()
  if (!query) return m.reply(`🔎 اكتب كلمة للبحث عن الأوامر.\nمثال: ${usedPrefix}بحث_الأوامر تحميل`)
  const matches = searchMenuCommands(global.plugins, query)
  if (!matches.length) return m.reply(`لم أجد أوامر تطابق «${query}». جرّب كلمة أقصر أو مرادفًا.`)
  const lines = matches.map(({ section, icon, label }) => `• ${label}\n  ${icon} ${section}`)
  return m.reply(`🔎 *نتائج البحث عن «${query}»* (${matches.length})\n\n${lines.join('\n')}`)
}

handler.help = ['بحث_الأوامر <كلمة>']
handler.tags = ['tools']
handler.command = /^(بحث_الأوامر|بحث_اوامر|دليل_الأوامر|دليل_اوامر|findcmd)$/i
export default handler
