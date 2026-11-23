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

export function getMenuCommandButtonRows(commands, usedPrefix = '.') {
  return commands.map(command => {
    const label = String(command).trim()
    const commandName = label.split(/\s+/)[0]
    const details = label.slice(commandName.length).replace(/[<>\[\]]/g, '').trim()
    const title = `${usedPrefix}${commandName}`
    return {
      title: Array.from(title).slice(0, 24).join(''),
      ...(details ? { description: Array.from(details).slice(0, 72).join('') } : {}),
      id: `${usedPrefix}${commandName}`
    }
  })
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

export function formatCategoryMenuText({ section, commandCount = 0 }) {
  const instruction = commandCount
    ? '🌸 اختر الأمر من زر «أوامر هذا القسم» أدناه.'
    : '🌷 لا توجد أوامر في هذا القسم حالياً.'

  return `╭━━━〔 ${section.icon} 𝐅𝐋𝐎𝐍𝐀 🎀 〕━━━╮
│  ✧ *${section.title}*
│  _🌸 أوامرك جاهزة، اختر ما يناسبك_
├┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┤
│  💎 *عدد الأوامر:* ${commandCount}
╰┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄╯
${instruction}

${ORNAMENT}
      _🦋 𝐅𝐋𝐎𝐍𝐀 • عالمك، بطريقتك 🦋_`
}
