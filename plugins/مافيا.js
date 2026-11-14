// 🕵️ المافيا والمدينة — لعبة جماعية للجروبات
// تعمل عبر واتساب مباشرة ولا تحتاج AIRich أو HTML.

const games = new Map()

function nameOf(m) { return (m.pushName || m.name || m.sender?.split('@')[0] || 'لاعب').slice(0, 24) }
function tag(jid) { return '@' + jid.split('@')[0] }
function roleName(role) {
  return { mafia: '🔪 مافيا', doctor: '🩺 طبيب', detective: '🕵️ محقق', citizen: '👨‍🌾 مواطن' }[role] || role
}
function alive(g) { return Object.entries(g.players).filter(([, p]) => p.alive) }
function findGameForPlayer(jid) {
  for (const [chat, g] of games) if (g.players[jid]) return [chat, g]
  return [null, null]
}
function aliveNames(g) { return alive(g).map(([jid, p]) => `${tag(jid)} (${p.name})`).join('، ') || 'لا يوجد' }
function score(g) {
  const ms = alive(g).filter(([, p]) => p.role === 'mafia').length
  const good = alive(g).filter(([, p]) => p.role !== 'mafia').length
  return `🔪 المافيا: ${ms}\n👨‍🌾 المدينة: ${good}`
}
function status(g) {
  return `🌙 الجولة: ${g.round}\n📍 المرحلة: ${g.phase === 'night' ? 'ليل' : 'نهار'}\n👥 الأحياء: ${alive(g).length}\n\n${score(g)}`
}
function winner(g) {
  const a = alive(g)
  const mafia = a.filter(([, p]) => p.role === 'mafia').length
  const town = a.filter(([, p]) => p.role !== 'mafia').length
  if (mafia === 0) return 'town'
  if (mafia >= town) return 'mafia'
  return null
}
function winnerText(result) {
  return result === 'mafia' ? '🔪 فازت المافيا! المدينة وقعت تحت سيطرتهم.' : '🎉 فازت المدينة! تم القضاء على المافيا.'
}
function help(prefix) {
  return `╭──「 🕵️ المافيا والمدينة 」──╮
│ ${prefix}مافيا — فتح لعبة جديدة
│ ${prefix}مافيا_انضم — الانضمام للعبة
│ ${prefix}مافيا_ابدأ — توزيع الأدوار
│ ${prefix}قائمة — عرض الأحياء
│ ${prefix}مافيا_حالة — حالة اللعبة
│
│ أثناء الليل:
│ ${prefix}مافيا_قتل @شخص — للمافيا
│ ${prefix}مافيا_حماية @شخص — للطبيب
│ ${prefix}مافيا_تحقيق @شخص — للمحقق
│ ${prefix}مافيا_نهار — إنهاء الليل
│
│ أثناء النهار:
│ ${prefix}مافيا_صوت @شخص — التصويت لطرده
│ ${prefix}مافيا_حسم — حساب الأصوات
│ ${prefix}حكم — عرض الأدوار بعد النهاية
│ ${prefix}انهاء — إلغاء اللعبة
╰──────────────────╯`
}
function mentioned(m) { return m.mentionedJid?.[0] || m.quoted?.sender || null }
function targetText(m) { return mentioned(m) ? tag(mentioned(m)) : 'الشخص المحدد' }

function endGame(g, result) {
  g.ended = true
  return `🏁 *انتهت اللعبة*\n\n${winnerText(result)}\n\n${g.playersList.map(([jid, p]) => `${tag(jid)} — ${roleName(p.role)} ${p.alive ? '✅' : '💀'}`).join('\n')}`
}

let handler = async (m, { args, usedPrefix, command, conn }) => {
  const prefix = usedPrefix || '.'
  const rawAction = String(command || '').toLowerCase()
  const action = rawAction === 'مساعدة_المافيا' ? 'ساعدني' : rawAction.replace(/^مافيا[_-]/, '')
  const sender = m.sender
  const chat = m.chat
  let g = games.get(chat)
  if (!g && !m.isGroup) [, g] = findGameForPlayer(sender)

  if (/^(مافيا|maf|mafia)$/i.test(action)) {
    if (!m.isGroup) return m.reply('❌ ابدأ اللعبة داخل جروب.')
    if (games.has(chat)) return m.reply('⚠️ توجد لعبة مافيا قائمة بالفعل في هذا الجروب.')
    g = { host: sender, phase: 'lobby', round: 0, players: {}, votes: {}, kills: {}, heal: null, inspect: null, ended: false }
    games.set(chat, g)
    return m.reply(`╭──「 🕵️ المافيا والمدينة 」──╮\n│ تم فتح التسجيل!\n│ أقل عدد: 5 لاعبين\n╰──────────────────╯\n\nللانضمام اكتب:\n*${prefix}مافيا_انضم*\n\nبعد اكتمال العدد يكتب صاحب اللعبة:\n*${prefix}مافيا_ابدأ*\n\nللمساعدة: ${prefix}مساعدة_المافيا`)
  }

  if (!g) return m.reply(`لا توجد لعبة مافيا. اكتب ${prefix}مافيا لبدء لعبة جديدة.`)

  if (/^(انضم|join)$/i.test(action)) {
    if (g.phase !== 'lobby') return m.reply('❌ انتهى التسجيل وبدأت اللعبة.')
    if (g.players[sender]) return m.reply('أنت منضم بالفعل.')
    g.players[sender] = { name: nameOf(m), role: null, alive: true, action: null }
    const count = Object.keys(g.players).length
    return m.reply(`✅ انضم *${nameOf(m)}* إلى اللعبة!\n👥 العدد الحالي: *${count}*\n\nيحتاج البدء إلى 5 لاعبين على الأقل.`)
  }

  if (/^(قائمة|players|اللاعبين)$/i.test(action)) {
    return m.reply(`👥 *قائمة اللاعبين*\n\n${Object.entries(g.players).map(([jid, p], i) => `${i + 1}. ${tag(jid)} — ${p.alive ? 'حي ✅' : 'خرج 💀'}`).join('\n') || 'لا يوجد لاعبون'}`)
  }

  if (/^(ابدأ|start)$/i.test(action)) {
    if (sender !== g.host) return m.reply('❌ صاحب اللعبة فقط يستطيع بدءها.')
    if (g.phase !== 'lobby') return m.reply('اللعبة بدأت بالفعل.')
    const ids = Object.keys(g.players)
    if (ids.length < 5) return m.reply('❌ يلزم 5 لاعبين على الأقل لبدء المافيا.')
    const roles = ids.length >= 8 ? ['mafia', 'mafia', 'doctor', 'detective'] : ['mafia', 'doctor', 'detective']
    while (roles.length < ids.length) roles.push('citizen')
    roles.sort(() => Math.random() - 0.5)
    ids.forEach((jid, i) => { g.players[jid].role = roles[i]; g.players[jid].alive = true })
    g.playersList = Object.entries(g.players)
    g.phase = 'night'; g.round = 1
    for (const jid of ids) {
      const p = g.players[jid]
      let privateText = `🕵️ *لعبة المافيا والمدينة*\n\nدورك السري: *${roleName(p.role)}*\n\n`
      if (p.role === 'mafia') privateText += `تعاون مع المافيا سرًا. في الليل استخدم:\n${prefix}مافيا_قتل @الشخص\n`
      if (p.role === 'doctor') privateText += `في كل ليلة احمِ لاعبًا من القتل:\n${prefix}مافيا_حماية @الشخص\n`
      if (p.role === 'detective') privateText += `في كل ليلة افحص لاعبًا:\n${prefix}مافيا_تحقيق @الشخص\n`
      if (p.role === 'citizen') privateText += 'راقب الكلام وصوّت لطرد المافيا في النهار.\n'
      privateText += `\nاللعبة في الجروب: ${chat}`
      try { await conn.sendMessage(jid, { text: privateText }) } catch {}
    }
    return m.reply(`🌙 *بدأت اللعبة — الليل الأول*\n\nتم إرسال الأدوار في الخاص لكل لاعب.\nالمافيا تختار ضحية، والطبيب يحمي، والمحقق يحقق.\n\nبعد انتهاء الجميع اكتب: *${prefix}مافيا_نهار*`)
  }

  if (/^(قتل|kill|nightkill)$/i.test(action)) {
    if (g.phase !== 'night') return m.reply('الآن نهار، لا يمكن تنفيذ قتل.')
    const p = g.players[sender]
    if (!p || !p.alive || p.role !== 'mafia') return m.reply('❌ هذا الأمر للمافيا فقط.')
    const target = mentioned(m)
    if (!target || !g.players[target] || !g.players[target].alive) return m.reply(`اذكر لاعبًا حيًا: ${prefix}مافيا_قتل @الشخص`)
    if (g.players[target].role === 'mafia') return m.reply('لا يمكنك قتل زميلك في المافيا.')
    g.kills[sender] = target
    return m.reply(`🔪 تم تسجيل اختيارك السري ضد ${targetText(m)}.`)
  }

  if (/^(حماية|heal|doctor)$/i.test(action)) {
    if (g.phase !== 'night') return m.reply('الآن نهار.')
    const p = g.players[sender], target = mentioned(m)
    if (!p || !p.alive || p.role !== 'doctor') return m.reply('❌ هذا الأمر للطبيب فقط.')
    if (!target || !g.players[target] || !g.players[target].alive) return m.reply(`اذكر لاعبًا حيًا: ${prefix}مافيا_حماية @الشخص`)
    g.heal = target
    return m.reply(`🩺 سجلت حماية اللاعب ${targetText(m)} سرًا.`)
  }

  if (/^(تحقيق|كشف|inspect)$/i.test(action)) {
    if (g.phase !== 'night') return m.reply('الآن نهار.')
    const p = g.players[sender], target = mentioned(m)
    if (!p || !p.alive || p.role !== 'detective') return m.reply('❌ هذا الأمر للمحقق فقط.')
    if (!target || !g.players[target] || !g.players[target].alive) return m.reply(`اذكر لاعبًا حيًا: ${prefix}مافيا_تحقيق @الشخص`)
    const isMafia = g.players[target].role === 'mafia'
    try { await conn.sendMessage(sender, { text: `🕵️ نتيجة التحقيق: ${tag(target)} ${isMafia ? 'مافيا 🔪' : 'ليس مافيا ✅'}` }) } catch {}
    return m.reply('🕵️ تم إرسال نتيجة التحقيق لك في الخاص.')
  }

  if (/^(نهار|day|endnight)$/i.test(action)) {
    if (sender !== g.host) return m.reply('❌ صاحب اللعبة فقط يستطيع إعلان النهار.')
    if (g.phase !== 'night') return m.reply('نحن في النهار بالفعل.')
    const chosen = Object.values(g.kills)[0]
    let announcement = `☀️ *طلع النهار — الجولة ${g.round}*\n\n`
    if (chosen && chosen !== g.heal && g.players[chosen]?.alive) {
      g.players[chosen].alive = false
      announcement += `💀 تم العثور على ${tag(chosen)} مقتولًا.\n`
    } else if (chosen === g.heal) announcement += '🩺 الطبيب أنقذ الضحية هذه الليلة! لم يمت أحد.\n'
    else announcement += '🌙 مرت الليلة بهدوء، لم يتم تسجيل ضحية.\n'
    g.phase = 'day'; g.votes = {}; g.kills = {}; g.heal = null
    const result = winner(g)
    if (result) { games.delete(chat); return m.reply(announcement + '\n' + endGame(g, result)) }
    return m.reply(announcement + `\nالأحياء:\n${aliveNames(g)}\n\nناقشوا ثم صوّتوا باستخدام:\n${prefix}مافيا_صوت @الشخص\n\nبعد اكتمال التصويت اكتبوا: ${prefix}مافيا_حسم`)
  }

  if (/^(صوت|تصويت|vote)$/i.test(action)) {
    if (g.phase !== 'day') return m.reply('التصويت متاح في النهار فقط.')
    const p = g.players[sender], target = mentioned(m)
    if (!p || !p.alive) return m.reply('❌ اللاعبون الأحياء فقط يصوتون.')
    if (!target || !g.players[target] || !g.players[target].alive || target === sender) return m.reply(`اذكر لاعبًا حيًا غير نفسك: ${prefix}مافيا_صوت @الشخص`)
    g.votes[sender] = target
    return m.reply(`🗳️ تم تسجيل صوتك.`)
  }

  if (/^(حسم|count|احسم)$/i.test(action)) {
    if (sender !== g.host) return m.reply('❌ صاحب اللعبة فقط يستطيع حسم التصويت.')
    if (g.phase !== 'day') return m.reply('لا يوجد تصويت حالي.')
    const counts = {}
    Object.values(g.votes).forEach(t => { counts[t] = (counts[t] || 0) + 1 })
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
    if (!sorted.length) return m.reply('❌ لم يصوت أحد بعد.')
    if (sorted.length > 1 && sorted[0][1] === sorted[1][1]) return m.reply('🤝 تعادل في الأصوات. أعيدوا التصويت.')
    const [out, votes] = sorted[0]
    g.players[out].alive = false
    const kicked = `⚖️ تم طرد ${tag(out)} بعد حصوله على ${votes} أصوات.\nدوره كان: *${roleName(g.players[out].role)}*`
    const result = winner(g)
    if (result) { games.delete(chat); return m.reply(kicked + '\n\n' + endGame(g, result)) }
    g.phase = 'night'; g.round++; g.votes = {}
    return m.reply(kicked + `\n\n🌙 بدأ الليل ${g.round}.\nأصحاب الأدوار ينفذون أوامرهم، ثم اكتب ${prefix}مافيا_نهار`)
  }

  if (/^(حالة|status|نتيجة)$/i.test(action)) return m.reply(status(g))
  if (/^(حكم|roles|الأدوار)$/i.test(action)) {
    if (!g.ended && !g.winner) return m.reply('الأدوار سرية حتى نهاية اللعبة.')
    return m.reply(g.playersList.map(([jid, p]) => `${tag(jid)} — ${roleName(p.role)}`).join('\n'))
  }
  if (/^(انهاء|إلغاء|الغاء|stop)$/i.test(action)) {
    if (sender !== g.host) return m.reply('❌ صاحب اللعبة فقط يستطيع إنهاءها.')
    games.delete(chat); return m.reply('🛑 تم إلغاء لعبة المافيا.')
  }
  if (/^(ساعدني|help)$/i.test(action)) return m.reply(help(prefix))
  return m.reply(`أمر غير معروف. اكتب ${prefix}مساعدة_المافيا لرؤية أوامر المافيا.`)
}

handler.help = ['مافيا', 'مافيا_انضم', 'مافيا_ابدأ', 'مافيا_قتل @', 'مافيا_حماية @', 'مافيا_تحقيق @', 'مافيا_نهار', 'مافيا_تصويت @', 'مافيا_حسم']
handler.tags = ['games']
handler.command = /^(مافيا|maf|mafia|مافيا_انضم|مافيا_قائمة|مافيا_اللاعبين|مافيا_ابدأ|مافيا_قتل|مافيا_حماية|مافيا_تحقيق|مافيا_كشف|مافيا_نهار|مافيا_صوت|مافيا_تصويت|مافيا_حسم|مافيا_احسم|مافيا_حالة|مافيا_نتيجة|مافيا_حكم|مافيا_انهاء|مافيا_إلغاء|مافيا_الغاء|مافيا_stop|مساعدة_المافيا)$/i

export default handler