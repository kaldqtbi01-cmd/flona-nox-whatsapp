const BRAND_MARK = '✦ 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 ✦'
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

export function formatMainMenuText({ mention, developer, uptime, time, sectionCount }) {
  return `╭━━━〔 ☾ 𝐅𝐋𝐎𝐍𝐀 𝐁𝐎𝐓 ☽ 〕━━━╮
│
│  ✨ أهلاً بك يا ${mention}
│  نورت عالم فلونا، مكانك بيننا يجمّل الحكاية.
│
├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┤
│  👑 المطوّر  ${developer}
│  ⏱️ متصل منذ  ${uptime}
│  🕰️ التوقيت  ${time}
│  📚 أقسام فلونا  ${sectionCount}
│
├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┤
│  اختر وجهتك من الأزرار بالأسفل
│  كل قسم مرتب بعناية لتصل إلى أمرك بسرعة.
│
╰━━〔 ${BRAND_MARK} 〕━━╯
       「 ذوقك • عالمك • فلونا 」`
}

export function formatCategoryMenuText({ section, commands, usedPrefix = '.' }) {
  const lines = commands.map(command => `${section.icon}  *${usedPrefix}${command}*`)
  const content = lines.length
    ? `${lines.join('\n')}`
    : `${section.icon} لا توجد أوامر في هذا القسم حالياً.`

  return `╭━━━〔 ${section.icon} 𝐅𝐋𝐎𝐍𝐀 〕━━━╮
│  ✧ ${section.title}
│  ✦ أوامرك جاهزة، اختر ما يناسبك
├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┤
│  📌 عدد الأوامر  ${commands.length}
╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯

${content}

${ORNAMENT}
      ✧ 𝐅𝐋𝐎𝐍𝐀 • عالمك، بطريقتك ✧`
}
