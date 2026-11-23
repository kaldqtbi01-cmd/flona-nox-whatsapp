const BRAND_MARK = '🌸 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 🎀'
const ORNAMENT = '━━━━━━━━━━━━━━━━━━━━'

export function formatUptime(totalSeconds) {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0))
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const remainder = seconds % 60
  const parts = []

  if (days) parts.push(`${days}ي`)
  if (hours || days) parts.push(`${hours}س`)
  if (minutes || hours || days) parts.push(`${minutes}د`)
  if (!parts.length) parts.push(`${remainder}ث`)

  return parts.join(' • ')
}

export const MENU_COMMANDS_PER_PAGE = 8

export function getMenuCommandButtonRows(commands, page, pageCount, tag, usedPrefix = '.') {
  const start = page * MENU_COMMANDS_PER_PAGE
  const rows = commands.slice(start, start + MENU_COMMANDS_PER_PAGE).map(command => {
    const commandName = String(command).trim().split(/\s+/)[0]
    const title = `${usedPrefix}${commandName}`
    return {
      title: Array.from(title).slice(0, 24).join(''),
      description: Array.from(`${usedPrefix}${command}`).slice(0, 72).join(''),
      id: `${usedPrefix}${commandName}`
    }
  })
  if (page > 0) rows.push({
    title: '⬅️ الصفحة السابقة',
    description: `الانتقال إلى الصفحة ${page}`,
    id: `${usedPrefix}menu ${tag} ${page - 1}`
  })
  if (page < pageCount - 1) rows.push({
    title: '➡️ الصفحة التالية',
    description: `الانتقال إلى الصفحة ${page + 2}`,
    id: `${usedPrefix}menu ${tag} ${page + 1}`
  })
  return rows
}

export function formatMainMenuText({ mention, developer, uptime, time, sectionCount }) {
  return `╭━━━〔 🎀 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 🎀 〕━━━╮
│
│  🦋 *أهلاً بك يا ${mention}* 🌸
│  _نورت عالم فلونا، مكانك بيننا يجمّل الحكاية._
│
├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┤
│  👑 *المطوّر:* ${developer}
│  ⏳ *مدة التشغيل:* ${uptime}
│  🌙 *التوقيت:* ${time}
│  💎 *أقسام فلونا:* ${sectionCount}
│
├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┤
│  💌 *اختر وجهتك من الأزرار بالأسفل*
│  _كل قسم مرتب بعناية لتصل إلى أمرك بسرعة._
│
╰━━〔 ${BRAND_MARK} 〕━━╯
       _「 🩷 ذوقك • عالمك • فلونا 🩷 」_`
}

export function formatCategoryMenuText({ section, commands, usedPrefix = '.', commandCount = commands.length, pageNumber = 1, pageCount = 1 }) {
  const lines = commands.map(command => `💗  *${usedPrefix}${command}*`)
  const content = lines.length
    ? `${lines.join('\n')}`
    : `🌷 لا توجد أوامر في هذا القسم حالياً.`

  return `╭━━━〔 ${section.icon} 𝐅𝐋𝐎𝐍𝐀 🎀 〕━━━╮
│  ✧ *${section.title}*
│  _🌸 أوامرك جاهزة، اختر ما يناسبك_
├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┤
│  💎 *عدد الأوامر:* ${commandCount}${pageCount > 1 ? ` • الصفحة ${pageNumber}/${pageCount}` : ''}
╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

${content}

${ORNAMENT}
      _🦋 𝐅𝐋𝐎𝐍𝐀 • عالمك، بطريقتك 🦋_`
}
