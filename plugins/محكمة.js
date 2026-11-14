// 🏛️ لعبة الحاكم والجلاد
// بلوقن جماعي: 5 لاعبين، مع إرسال الأدوار سرًا في الخاص.

const games = new Map()

function playerName(m) {
  return (m.pushName || m.name || m.sender?.split('@')[0] || 'لاعب').slice(0, 24)
}
function tag(jid) { return '@' + jid.split('@')[0] }
function roleName(role) {
  return {
    executioner: 'الجلاد',
    governor: 'الحاكم',
    thief: 'اللص',
    inspector: 'المفتش',
    just: 'العادل'
  }[role] || role
}
function shuffled(items) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}
function roleList(g) {
  return Object.entries(g.players)
    .map(([jid, p]) => `${tag(jid)} — ${roleName(p.role)}`)
    .join('\n')
}
function getMention(m) {
  return m.mentionedJid?.[0] || m.quoted?.sender || null
}
function commandText(args) {
  return Array.isArray(args) ? args.join(' ').trim() : ''
}
function help(prefix) {
  return `╭──「 🏛️ الحاكم والجلاد 」──╮
│ ${prefix}محكمة — فتح التسجيل
│ ${prefix}سجل — الانضمام (5 لاعبين)
│ ${prefix}انطلاق — توزيع الأدوار وبدء اللعبة
│ ${prefix}أدوار_جديدة — إعادة إرسال الأدوار في الخاص
│
│ ${prefix}اتهام — عرض قائمة اللاعبين للمفتش
│ ${prefix}اتهام @لاعب — اتهام لاعب
│ ${prefix}حكم <نص> — حكم الحاكم
│ ${prefix}استئناف — طلب المحكوم عليه مراجعة الحكم
│ ${prefix}قبول — العادل يقبل المراجعة
│ ${prefix}رفض — العادل يرفض المراجعة
│ ${prefix}حكم_جديد <نص> — حكم العادل بعد قبول المراجعة
│ ${prefix}جلد — تنفيذ الجلاد للحكم
│
│ ${prefix}حالة_المحكمة — عرض مرحلة اللعبة
│ ${prefix}إيقاف_المحكمة — إلغاء اللعبة (لصاحبها)
│ ${prefix}مساعدة_المحكمة — عرض هذه القائمة
╰────────────────────────╯`
}
function sendRoles(g, conn, prefix) {
  const roleText = {
    executioner: `دورك: *الجلاد*. نفّذ الحكم داخل اللعبة بالأمر: ${prefix}جلد`,
    governor: `دورك: *الحاكم*. بعد اتهام المفتش للص، اكتب الحكم بالأمر: ${prefix}حكم <نص الحكم>.`,
    thief: `دورك: *اللص*. حاول ألّا يكتشفك المفتش. إذا اتهمك المفتش، سيصدر الحاكم حكمًا ويمكنك طلب مراجعته بالأمر: ${prefix}استئناف`,
    inspector: `دورك: *المفتش*. استخدم ${prefix}اتهام من دون منشن لعرض قائمة اللاعبين، ثم اتهم لاعبًا بكتابة: ${prefix}اتهام @اللاعب. إذا كان هو اللص أصبت، وإذا أخطأت يقع الجلد عليك.`,
    just: `دورك: *العادل*. إذا طلب المحكوم عليه مراجعة، استخدم ${prefix}قبول أو ${prefix}رفض. عند قبولها، اختر حكمًا جديدًا بالأمر: ${prefix}حكم_جديد <نص الحكم>.`
  }
  return Promise.all(Object.entries(g.players).map(async ([jid, p]) => {
    const text = `🏛️ *لعبة الحاكم والجلاد*\n\n${roleText[p.role]}\n\nاللعبة في الجروب: ${g.chat}`
    try {
      await conn.sendMessage(jid, { text })
      return null
    } catch {
      return p.name
    }
  }))
}

let handler = async (m, { args, usedPrefix, command, conn }) => {
  const prefix = usedPrefix || '.'
  const action = String(command || '').toLowerCase()
  const sender = m.sender
  const chat = m.chat
  const text = commandText(args)

  if (/^(مساعدة_المحكمة|helpcourt)$/i.test(action)) return m.reply(help(prefix))
  if (/^(محكمة|court)$/i.test(action)) {
    if (!m.isGroup) return m.reply('❌ افتح اللعبة داخل جروب.')
    if (games.has(chat)) return m.reply('⚠️ توجد لعبة قائمة بالفعل في هذا الجروب.')
    games.set(chat, {
      chat,
      host: sender,
      phase: 'lobby',
      players: {},
      accused: null,
      sentence: '',
      appealed: false,
      rolesRevealed: false
    })
    return m.reply(`🏛️ تم فتح التسجيل في لعبة الحاكم والجلاد!\n\nيحتاج اللعب إلى *5 لاعبين بالضبط*.\nللانضمام اكتب: *${prefix}سجل*\nوبعد اكتمال العدد، يبدأ صاحب اللعبة بكتابة: *${prefix}انطلاق*\n\nلشرح الأوامر: ${prefix}مساعدة_المحكمة`)
  }

  const g = games.get(chat)
  if (!g) return m.reply(`لا توجد لعبة قائمة هنا. لفتح لعبة اكتب ${prefix}محكمة`)

  if (/^(سجل|joincourt)$/i.test(action)) {
    if (g.phase !== 'lobby') return m.reply('❌ انتهى التسجيل وبدأت اللعبة.')
    if (g.players[sender]) return m.reply('أنت مسجل بالفعل.')
    const count = Object.keys(g.players).length
    if (count >= 5) return m.reply('❌ اكتمل عدد اللاعبين؛ الحد هو 5.')
    g.players[sender] = { name: playerName(m), role: null }
    const now = Object.keys(g.players).length
    return m.reply(`✅ انضم *${playerName(m)}* إلى اللعبة.\n👥 العدد: *${now}/5*`)
  }

  if (/^(انطلاق|startcourt)$/i.test(action)) {
    if (sender !== g.host) return m.reply('❌ صاحب اللعبة فقط يستطيع بدءها.')
    if (g.phase !== 'lobby') return m.reply('اللعبة بدأت بالفعل.')
    const ids = Object.keys(g.players)
    if (ids.length !== 5) return m.reply(`❌ يلزم وجود 5 لاعبين بالضبط. العدد الحالي: ${ids.length}.`)
    const roles = shuffled(['executioner', 'governor', 'thief', 'inspector', 'just'])
    ids.forEach((jid, i) => { g.players[jid].role = roles[i] })
    g.phase = 'accusation'
    const failed = await sendRoles(g, conn, prefix)
    if (failed.filter(Boolean).length) {
      return m.reply(`⚠️ بدأت اللعبة، لكن تعذر إرسال الدور في الخاص إلى: ${failed.filter(Boolean).join('، ')}\nاطلب منهم فتح محادثة البوت، ثم استخدم ${prefix}أدوار_جديدة لإعادة الإرسال.`)
    }
    return m.reply(`🎭 بدأت اللعبة! أُرسلت الأدوار إلى اللاعبين في الخاص.\n\nالمفتش، اكتب ${prefix}اتهام لعرض قائمة اللاعبين، ثم اتهم أحدهم بالمنشن.\n\nملاحظة: إذا أصاب المفتش أو أخطأ، سيكشف البوت أدوار اللاعبين الخمسة في الجروب كما طلبتم.`)
  }

  if (/^(أدوار_جديدة|resendcourtroles)$/i.test(action)) {
    if (sender !== g.host) return m.reply('❌ صاحب اللعبة فقط يستطيع إعادة إرسال الأدوار.')
    if (g.phase === 'lobby') return m.reply('ابدأ اللعبة أولًا حتى تُوزع الأدوار.')
    const failed = await sendRoles(g, conn, prefix)
    return m.reply(failed.filter(Boolean).length
      ? `⚠️ تعذر الإرسال إلى: ${failed.filter(Boolean).join('، ')}`
      : '✅ أُعيد إرسال الأدوار إلى اللاعبين في الخاص.')
  }

  if (/^(اتهام|accusecourt)$/i.test(action)) {
    if (g.phase !== 'accusation') return m.reply('❌ لا يمكن تقديم اتهام في هذه المرحلة.')
    const inspector = g.players[sender]
    if (!inspector || inspector.role !== 'inspector') return m.reply('❌ أمر الاتهام للمفتش فقط.')
    const target = getMention(m)
    if (!target) {
      const players = Object.entries(g.players).filter(([jid]) => jid !== sender)
      const mentions = players.map(([jid]) => jid)
      const list = players.map(([jid, p]) => `${tag(jid)} — ${p.name}`).join('\n')
      await conn.sendMessage(chat, { text: `🕵️ *قائمة اللاعبين للاختيار*\n${list}\n\nأيها المفتش، اتهم لاعبًا باستخدام: ${prefix}اتهام @اللاعب`, mentions })
      return
    }
    if (!g.players[target] || target === sender) return m.reply(`❌ اختر لاعبًا آخر من المشاركين باستخدام: ${prefix}اتهام @اللاعب`)
    g.accused = target
    g.rolesRevealed = true
    if (g.players[target].role === 'thief') {
      g.phase = 'governor'
      return conn.sendMessage(chat, {
        text: `✅ اتهام صحيح! ${tag(target)} هو اللص.\n\n🎭 *هويات اللاعبين:*\n${roleList(g)}\n\nالحاكم، اكتب الحكم باستخدام: ${prefix}حكم <نص الحكم>`,
        mentions: Object.keys(g.players)
      })
    }
    g.sentence = 'جلد المفتش بسبب اتهام خاطئ'
    g.phase = 'execute'
    return conn.sendMessage(chat, {
      text: `❌ اتهام خاطئ! ${tag(target)} ليس اللص. سيُجلد المفتش بسبب الاتهام الخاطئ.\n\n🎭 *هويات اللاعبين:*\n${roleList(g)}\n\nالجلاد، نفّذ الحكم بالأمر: ${prefix}جلد`,
      mentions: Object.keys(g.players)
    })
  }

  if (/^(حكم|sentencecourt)$/i.test(action)) {
    if (g.phase !== 'governor') return m.reply('❌ لا يوجد حكم مطلوب من الحاكم الآن.')
    if (g.players[sender]?.role !== 'governor') return m.reply('❌ هذا الأمر للحاكم فقط.')
    if (!text) return m.reply(`اكتب الحكم بعد الأمر، مثل: ${prefix}حكم السجن داخل اللعبة لثلاث جولات`)
    g.sentence = text
    g.phase = 'appeal_decision'
    return m.reply(`⚖️ أصدر الحاكم الحكم على ${tag(g.accused)}:\n*${g.sentence}*\n\nإذا أراد المحكوم عليه المراجعة، يكتب: ${prefix}استئناف. وإلا يكتب الجلاد ${prefix}جلد لتنفيذ الحكم.`)
  }

  if (/^(استئناف|appealcourt)$/i.test(action)) {
    if (g.phase !== 'appeal_decision') return m.reply('❌ لا يوجد حكم متاح للمراجعة الآن.')
    if (sender !== g.accused) return m.reply('❌ طلب المراجعة متاح للشخص المحكوم عليه فقط.')
    g.appealed = true
    g.phase = 'justice_decision'
    return m.reply('📨 تم تسجيل طلب المراجعة. العادل يقرر الآن: استخدم قبول أو رفض.')
  }

  if (/^(قبول|acceptappeal)$/i.test(action)) {
    if (g.phase !== 'justice_decision') return m.reply('❌ لا يوجد طلب مراجعة بانتظار القرار.')
    if (g.players[sender]?.role !== 'just') return m.reply('❌ هذا القرار للعادل فقط.')
    g.phase = 'new_sentence'
    return m.reply(`✅ قبل العادل طلب المراجعة. العادل يختار حكمًا جديدًا بالأمر: ${prefix}حكم_جديد <نص الحكم>`)
  }

  if (/^(رفض|rejectappeal)$/i.test(action)) {
    if (g.phase !== 'justice_decision') return m.reply('❌ لا يوجد طلب مراجعة بانتظار القرار.')
    if (g.players[sender]?.role !== 'just') return m.reply('❌ هذا القرار للعادل فقط.')
    g.phase = 'execute'
    return m.reply(`❌ رفض العادل طلب المراجعة. يبقى حكم الحاكم كما هو:\n*${g.sentence}*\n\nالجلاد، نفّذ الحكم بالأمر: ${prefix}جلد`)
  }

  if (/^(حكم_جديد|newsentencecourt)$/i.test(action)) {
    if (g.phase !== 'new_sentence') return m.reply('❌ لا يوجد حكم جديد مطلوب الآن.')
    if (g.players[sender]?.role !== 'just') return m.reply('❌ اختيار الحكم الجديد من صلاحية العادل فقط.')
    if (!text) return m.reply(`اكتب الحكم الجديد بعد الأمر، مثل: ${prefix}حكم_جديد اعتذار علني داخل اللعبة`)
    g.sentence = text
    g.phase = 'execute'
    return m.reply(`⚖️ اختار العادل حكمًا جديدًا:\n*${g.sentence}*\n\nالجلاد، نفّذ الحكم بالأمر: ${prefix}جلد`)
  }

  if (/^(جلد|executejailor)$/i.test(action)) {
    if (!['execute', 'appeal_decision'].includes(g.phase)) return m.reply('❌ لا يوجد حكم جاهز للتنفيذ.')
    if (g.players[sender]?.role !== 'executioner') return m.reply('❌ تنفيذ الحكم من صلاحية الجلاد فقط.')
    const target = g.players[g.accused]?.role === 'thief' ? g.accused : Object.keys(g.players).find(jid => g.players[jid].role === 'inspector')
    const targetName = g.players[target]?.name || 'اللاعب المحدد'
    const outcome = `🔨 تم تنفيذ الحكم داخل اللعبة على ${tag(target)} (*${targetName}*):\n*${g.sentence}*\n\n🏁 انتهت الجولة.`
    const roles = `🎭 *هويات اللاعبين:*\n${roleList(g)}`
    games.delete(chat)
    return conn.sendMessage(chat, { text: `${outcome}\n\n${roles}`, mentions: Object.keys(g.players) })
  }

  if (/^(حالة_المحكمة|statuscourt)$/i.test(action)) {
    const phaseNames = {
      lobby: 'التسجيل',
      accusation: 'اتهام المفتش',
      governor: 'اختيار حكم الحاكم',
      appeal_decision: 'إمكانية طلب المراجعة',
      justice_decision: 'قرار العادل',
      new_sentence: 'اختيار حكم جديد',
      execute: 'تنفيذ الحكم'
    }
    return m.reply(`🏛️ المرحلة: ${phaseNames[g.phase] || g.phase}\n👥 اللاعبون: ${Object.keys(g.players).length}/5`)
  }

  if (/^(إيقاف_المحكمة|stopcourt)$/i.test(action)) {
    if (sender !== g.host) return m.reply('❌ صاحب اللعبة فقط يستطيع إيقافها.')
    games.delete(chat)
    return m.reply('🛑 تم إيقاف لعبة الحاكم والجلاد.')
  }

  return m.reply(`أمر غير معروف. اكتب ${prefix}مساعدة_المحكمة لعرض الأوامر.`)
}

handler.help = ['محكمة', 'سجل', 'انطلاق', 'أدوار_جديدة', 'اتهام', 'حكم', 'استئناف', 'قبول', 'رفض', 'حكم_جديد', 'جلد', 'حالة_المحكمة', 'إيقاف_المحكمة', 'مساعدة_المحكمة']
handler.tags = ['games']
handler.command = /^(محكمة|court|سجل|joincourt|انطلاق|startcourt|أدوار_جديدة|resendcourtroles|اتهام|accusecourt|حكم|sentencecourt|استئناف|appealcourt|قبول|acceptappeal|رفض|rejectappeal|حكم_جديد|newsentencecourt|جلد|executejailor|حالة_المحكمة|statuscourt|إيقاف_المحكمة|stopcourt|مساعدة_المحكمة|helpcourt)$/i

export default handler