/*
 * 🎲 FLONA BOT — لعبة صندوق الأحكام
 * لعبة ترفيهية آمنة: لا تغيّر اسم اللاعب أو حالته تلقائيًا.
 */

const activeGames = new Map()
const timers = new Map()

const judgments = [
  'غيّر لقبك في المجموعة إلى كتكوت الحارة لمدة 30 دقيقة.',
  'اكتب خمس رسائل بدون أي فواصل أو نقاط.',
  'اكتب في المجموعة: أنا وزير الدلع وقد تم تعييني اليوم.',
  'غيّر اسم العرض إلى بطاطسة مكسورة لمدة 30 دقيقة.',
  'اكتب بيت شعر مضحكًا من تأليفك.',
  'تحدث بالفصحى لمدة 10 دقائق.',
  'اكتب رسالة كاملة بدون حرف الألف.',
  'اختر لاعبًا وامدحه بثلاث صفات جميلة.',
  'اكتب اعتذارًا رسميًا لأنك خسرت اللعبة.',
  'غيّر لقبك إلى الأمير المنهار لمدة 30 دقيقة.',
  'اكتب خمس رسائل تبدأ بكلمة يا جماعة.',
  'اكتب نكتة جديدة من تأليفك.',
  'تحدث كأنك مذيع أخبار لمدة خمس رسائل.',
  'اكتب جملة من عشر كلمات دون استخدام الإيموجي.',
  'اختر لاعبًا وقل له لقبًا مضحكًا بموافقته.',
  'اكتب: أنا أسطورة ولكن الحظ لا يعرفني.',
  'اجعل كل إجاباتك القادمة على شكل سؤال لثلاث رسائل.',
  'اكتب رسالة طويلة بدون مسافات لمدة 5 رسائل.',
  'غيّر لقبك إلى أبو قلب فراشة لمدة 30 دقيقة.',
  'اكتب إعلانًا رسميًا عن فوزك الوهمي.',
  'اكتب عشر كلمات تبدأ بحرف الميم.',
  'تحدث كأنك أستاذ يشرح درسًا سخيفًا.',
  'اكتب رسالة شكر للجروب بأسلوب ملكي.',
  'اكتب جملة مضحكة باستخدام ثلاثة إيموجيات.',
  'اختر لاعبًا وقل له لقبًا لطيفًا.',
  'اكتب خمس رسائل تنتهي بكلمة انتهى.',
  'غيّر لقبك إلى المدير بدون صلاحيات لمدة 30 دقيقة.',
  'اكتب قصة قصيرة من ثلاثة أسطر عن بطاطسة.',
  'أجب عن ثلاث رسائل باللغة العربية الفصحى.',
  'اكتب: أنا دخلت اللعبة بكامل ثقتي وخرجت بلا كرامة.',
  'اكتب جملة كاملة دون استخدام حرف الراء.',
  'تحدث كأنك روبوت لمدة خمس رسائل.',
  'اختر لاعبًا وقل له عبارة تشجيع.',
  'اكتب رسالة دون استخدام أي إيموجي لمدة 15 دقيقة.',
  'غيّر لقبك إلى الفيلسوف النعسان لمدة 30 دقيقة.',
  'اكتب خمسة أمثال شعبية.',
  'اكتب قصيدة قصيرة عن الجوع.',
  'اكتب اعتذارًا مضحكًا عن تأخرك في الرد.',
  'أجب عن ثلاث رسائل باستخدام كلمة حاضر فقط عندما تكون مناسبة.',
  'اكتب إعلان توظيف عن منصب ملك البطاطس.',
  'غيّر لقبك إلى عصفور بلا أجنحة لمدة 30 دقيقة.',
  'اكتب عشر كلمات دون استخدام حرف السين.',
  'تحدث كأنك مذيعًا رياضيًا لمدة خمس رسائل.',
  'اكتب رسالة ترحيب رسمية لأعضاء المجموعة.',
  'اطلب من لاعب أن يختار لك لقبًا لطيفًا.',
  'اكتب ثلاث جمل كلها تبدأ بكلمة ربما.',
  'اكتب جملة من 15 كلمة دون نقاط أو فواصل.',
  'غيّر لقبك إلى أسطورة الفشل اللطيف لمدة 30 دقيقة.',
  'اكتب وصفًا مضحكًا لنفسك في ثلاثة أسطر.',
  'اكتب رسالة وكأنك وزير يقدم استقالته بسبب الخسارة.',
  'تحدث بلهجة يمنية لمدة خمس رسائل.',
  'اكتب خمس كلمات معكوسة ثم اكتب معناها الصحيح.',
  'اكتب جملة لا تحتوي على حرف الألف أو الياء.',
  'اختر لاعبًا وقل له شيئًا إيجابيًا.',
  'غيّر لقبك إلى كابتن النعاس لمدة 30 دقيقة.',
  'اكتب رسالة وكأنك تعلن افتتاح مملكة جديدة.',
  'اكتب نكتة عن طالب نسي واجبه.',
  'أجب عن خمس رسائل دون استخدام علامة التعجب.',
  'اكتب خطابًا رسميًا تطلب فيه ترقية إلى منصب بطاطسة.',
  'اكتب: أنا لا أخسر، أنا أوزع فرص الفوز.',
  'غيّر لقبك إلى وزير الطبطبة لمدة 30 دقيقة.',
  'اكتب قصة من أربعة أسطر تبدأ بكان يا ما كان.',
  'تحدث كأنك شاعر لمدة خمس رسائل.',
  'اكتب عشر كلمات تبدأ بحرف الباء.',
  'اكتب جملة مضحكة بدون استخدام حرف الكاف.',
  'اكتب رسالة شكر لشخص يختاره البوت.',
  'غيّر لقبك إلى ملك الدلع لمدة 30 دقيقة.',
  'اكتب إعلانًا عن اختفاء آخر ذرة من الحظ.',
  'اكتب خمس رسائل بدون استخدام كلمة أنا.',
  'تحدث وكأنك تقدم نشرة الطقس.',
  'اكتب وصفًا لمجموعة واتساب وكأنها دولة مستقلة.',
  'اكتب رسالة من 20 كلمة دون فواصل.',
  'غيّر لقبك إلى المدير النائم لمدة 30 دقيقة.',
  'اكتب ثلاث حكم مضحكة من تأليفك.',
  'اطلب من لاعب أن يسألك سؤالًا ثقافيًا.',
  'اكتب رسالة وكأنك تعلن فوزك بجائزة لا وجود لها.',
  'تحدث كأنك معلّق مباراة لمدة خمس رسائل.',
  'اكتب خمس جمل تنتهي بكلمة جميل.',
  'غيّر لقبك إلى الكتكوت الأسطوري لمدة 30 دقيقة.',
  'اكتب رسالة اعتذار للحظ لأنه لم يقف معك.',
  'اكتب جملة من عشرة كلمات دون استخدام حرف الميم.',
  'اكتب قصة قصيرة عن هاتف قرر أن يأخذ إجازة.',
  'أجب عن ثلاث رسائل وكأنك ملك يتحدث إلى شعبه.',
  'اختر لاعبًا وقل له لقبًا لطيفًا بموافقته.',
  'غيّر لقبك إلى أبو بطارية ضعيفة لمدة 30 دقيقة.',
  'اكتب إعلانًا عن افتتاح مدرسة لتعليم البطاطس.',
  'اكتب خمس رسائل دون استخدام الإيموجي.',
  'اكتب بيتين من الشعر عن الخسارة.',
  'تحدث كأنك محقق يبحث عن آخر نقطة في رصيدك.',
  'غيّر لقبك إلى صاحب الحظ المفقود لمدة 30 دقيقة.',
  'اكتب رسالة من دون مسافات لمدة 10 رسائل.',
  'اكتب جملة كاملة دون استخدام حرف التاء.',
  'اكتب خطابًا رسميًا تعلن فيه اعتزالك الألعاب لمدة دقيقة.',
  'اختر لاعبًا وامدحه بأسلوب مبالغ فيه لكن محترم.',
  'غيّر لقبك إلى أمير الفوضى اللطيفة لمدة 30 دقيقة.',
  'اكتب خمس رسائل بالفصحى دون استخدام اللهجة العامية.',
  'اكتب قصة من ثلاثة أسطر عن لاعب اختار الرقم الخطأ.',
  'تحدث وكأنك مدير مدرسة لمدة خمس رسائل.',
  'اكتب اعترافًا مضحكًا بأن الحظ هزمك اليوم.',
  'اكتب خطابًا رسميًا تعلن فيه أنك بطل الأحكام رغم أنك لم تفز.'
]

function dbChat(chat) {
  global.db.data.chats[chat] ||= {}
  global.db.data.chats[chat].flonaJudgments ||= { history: [], penalties: {} }
  return global.db.data.chats[chat].flonaJudgments
}

function numberFrom(value) {
  return String(value || '').replace(/\D/g, '')
}

function targetUser(m, args) {
  return m.mentionedJid?.[0] || `${numberFrom(args?.[0])}@s.whatsapp.net`
}

function clearTimer(chat) {
  if (timers.has(chat)) clearTimeout(timers.get(chat))
  timers.delete(chat)
}

function penalty(chat, jid, reason) {
  const data = dbChat(chat)
  data.penalties[jid] = { reason, at: Date.now(), by: 'FLONA BOT' }
}

function isLocked(chat, jid) {
  return Boolean(dbChat(chat).penalties[jid])
}

function help(prefix) {
  return `🎲 *لعبة صندوق الأحكام — FLONA BOT*\n\n` +
    `${prefix}أحكام — بدء جولة جديدة\n` +
    `${prefix}اختيار_حكم 1 — اختيار رقم من 1 إلى 100\n` +
    `${prefix}قبول_حكم — قبول الحكم وبدء المهلة\n` +
    `${prefix}تنفيذ_حكم — تأكيد تنفيذ الحكم\n` +
    `${prefix}رفض_حكم — رفض حكم بعد قبوله\n` +
    `${prefix}حالة_حكم — عرض حالة الجولة\n\n` +
    `أوامر المالك:\n${prefix}عقوبات\n${prefix}فك_عقوبة @العضو\n${prefix}سجل_عقوبات`
}

let handler = async (m, { conn, args, usedPrefix, command, isOwner, isROwner }) => {
  if (!m.isGroup && !['عقوبات', 'سجل_عقوبات', 'فك_عقوبة'].includes(command))
    return m.reply('❌ لعبة الأحكام تعمل داخل المجموعات فقط.')

  const prefix = usedPrefix || '.'
  const chat = m.chat
  const sender = m.sender
  const data = dbChat(chat)
  const action = String(command || '').toLowerCase()
  let game = activeGames.get(chat)

  if (/^(مساعدة_الأحكام|مساعدة_حكم|احكام_مساعدة)$/i.test(action)) return m.reply(help(prefix))

  if (/^(أحكام|احكام|حكم_صندوق)$/i.test(action)) {
    if (isLocked(chat, sender)) return m.reply('🚫 أنت ممنوع مؤقتًا من ألعاب الأحكام بسبب عدم تنفيذ حكم سابق.')
    if (game) return m.reply(`⚠️ توجد جولة قائمة بالفعل.\nاختار رقمًا باستخدام:\n${prefix}اختيار_حكم 1`)
    game = { chat, host: sender, player: sender, number: null, judgment: null, accepted: false, startedAt: Date.now(), previous: data.history.slice(-10) }
    activeGames.set(chat, game)
    return m.reply(`🎲 *بدأت لعبة صندوق الأحكام!*\n\nاللاعب: @${sender.split('@')[0]}\nاختر رقمًا من 1 إلى 100 دون أن تعرف الحكم:\n\n${prefix}اختيار_حكم 1\n\n⚠️ لا تُجبر نفسك على تغيير اسمك أو حالتك؛ نفّذ ما يناسبك وأكّد التنفيذ بنفسك.`, null, { mentions: [sender] })
  }

  if (/^اختيار_حكم$/i.test(action)) {
    if (!game) return m.reply(`لا توجد جولة. اكتب ${prefix}أحكام أولًا.`)
    if (game.player !== sender) return m.reply('❌ هذه الجولة للاعب الذي بدأها.')
    if (game.number) return m.reply(`تم اختيار الرقم ${game.number} بالفعل.`)
    const n = Number(args?.[0])
    if (!Number.isInteger(n) || n < 1 || n > 100) return m.reply(`اختر رقمًا صحيحًا من 1 إلى 100. مثال: ${prefix}اختيار_حكم 37`)
    let selected = n
    for (let i = 0; i < 100 && data.history.includes(selected); i++) selected = ((selected + i) % 100) + 1
    game.number = n
    game.judgment = judgments[selected - 1]
    return m.reply(`🎯 الرقم المختار: *${n}*\n\n📜 *الحكم:*\n${game.judgment}\n\nإذا قبلت الحكم أرسل:\n${prefix}قبول_حكم\n\nولك الحق في رفضه قبل القبول دون عقوبة.`)
  }

  if (/^قبول_حكم$/i.test(action)) {
    if (!game || game.player !== sender || !game.judgment) return m.reply(`لا يوجد حكم تختاره. اكتب ${prefix}أحكام ثم ${prefix}اختيار_حكم 1`)
    if (game.accepted) return m.reply('الحكم مقبول والمهلة بدأت بالفعل.')
    game.accepted = true
    game.deadline = Date.now() + 30 * 60 * 1000
    clearTimer(chat)
    timers.set(chat, setTimeout(() => {
      const current = activeGames.get(chat)
      if (current?.accepted && !current.completed) {
        penalty(chat, current.player, `عدم تنفيذ الحكم رقم ${current.number}`)
        activeGames.delete(chat)
      }
      timers.delete(chat)
    }, 30 * 60 * 1000))
    return m.reply(`✅ تم قبول الحكم. أمامك 30 دقيقة للتنفيذ.\nبعد التنفيذ أرسل: ${prefix}تنفيذ_حكم`)
  }

  if (/^تنفيذ_حكم$/i.test(action)) {
    if (!game || game.player !== sender || !game.accepted) return m.reply('لا يوجد حكم مقبول لتأكيد تنفيذه.')
    game.completed = true
    data.history.push(game.number)
    if (data.history.length > 20) data.history.shift()
    clearTimer(chat)
    activeGames.delete(chat)
    return m.reply('✅ تم تسجيل تنفيذ الحكم. أحسنت، انتهت الجولة دون عقوبة.')
  }

  if (/^رفض_حكم$/i.test(action)) {
    if (!game || game.player !== sender || !game.judgment) return m.reply('لا توجد جولة نشطة.')
    if (!game.accepted) {
      activeGames.delete(chat)
      return m.reply('تم رفض الحكم قبل قبوله، وانتهت الجولة دون عقوبة.')
    }
    penalty(chat, sender, `رفض تنفيذ الحكم رقم ${game.number}`)
    clearTimer(chat)
    activeGames.delete(chat)
    return m.reply(`🚫 تم تسجيل عدم التنفيذ ومنعك مؤقتًا من ألعاب الأحكام.\nيمكن للمالك فك المنع بأمر ${prefix}فك_عقوبة @منشن`)
  }

  if (/^حالة_حكم$/i.test(action)) {
    if (!game) return m.reply('لا توجد جولة أحكام نشطة.')
    const remaining = game.deadline ? Math.max(0, Math.ceil((game.deadline - Date.now()) / 60000)) : null
    return m.reply(`🎲 حالة الجولة\nاللاعب: @${game.player.split('@')[0]}\nالرقم: ${game.number || 'لم يُختر بعد'}\nالحالة: ${game.accepted ? 'الحكم مقبول' : 'بانتظار الاختيار أو القبول'}\n${remaining !== null ? `الوقت المتبقي: ${remaining} دقيقة` : ''}`, null, { mentions: [game.player] })
  }

  if (/^عقوبات$/i.test(action)) {
    if (!isOwner && !isROwner) return m.reply('❌ هذا الأمر للمالك فقط.')
    const rows = Object.entries(data.penalties)
    return m.reply(rows.length ? `🚫 العقوبات المسجلة:\n\n${rows.map(([jid, p]) => `• @${jid.split('@')[0]} — ${p.reason}`).join('\n')}` : '✅ لا توجد عقوبات مسجلة في هذه المجموعة.', null, { mentions: rows.map(([jid]) => jid) })
  }

  if (/^سجل_عقوبات$/i.test(action)) {
    if (!isOwner && !isROwner) return m.reply('❌ هذا الأمر للمالك فقط.')
    return m.reply(`📋 عدد العقوبات الحالية: ${Object.keys(data.penalties).length}\n📚 آخر أرقام الأحكام: ${data.history.length ? data.history.join('، ') : 'لا يوجد'}`)
  }

  if (/^فك_عقوبة$/i.test(action)) {
    if (!isOwner && !isROwner) return m.reply('❌ هذا الأمر للمالك فقط.')
    const jid = targetUser(m, args)
    if (!numberFrom(jid)) return m.reply(`استخدم: ${prefix}فك_عقوبة @العضو`)
    if (!data.penalties[jid]) return m.reply('لا توجد عقوبة مسجلة لهذا العضو.')
    delete data.penalties[jid]
    return m.reply(`✅ تم فك العقوبة عن @${jid.split('@')[0]}.`, null, { mentions: [jid] })
  }

  return m.reply(help(prefix))
}

handler.help = ['أحكام', 'اختيار_حكم 1', 'قبول_حكم', 'تنفيذ_حكم', 'رفض_حكم', 'حالة_حكم', 'عقوبات', 'فك_عقوبة']
handler.tags = ['games']
handler.command = /^(أحكام|احكام|حكم_صندوق|اختيار_حكم|قبول_حكم|تنفيذ_حكم|رفض_حكم|حالة_حكم|عقوبات|فك_عقوبة|سجل_عقوبات|مساعدة_الأحكام|مساعدة_حكم|احكام_مساعدة)$/i

export default handler
