import { awardGamePoint } from '../lib/game-leaderboard.js'

// 🎯 تحدي البنات والشباب — لعبة جماعية للجروبات
// تعمل مباشرة داخل واتساب وبدون AIRich أو HTML.

const games = new Map()

const questions = [
  { q: 'ما هو الكوكب المعروف بالكوكب الأحمر؟', a: ['الأرض', 'المريخ', 'زحل', 'عطارد'], correct: 2 },
  { q: 'كم عدد أيام الأسبوع؟', a: ['5', '6', '7', '8'], correct: 3 },
  { q: 'ما عاصمة مصر؟', a: ['القاهرة', 'الرباط', 'دمشق', 'تونس'], correct: 1 },
  { q: 'ما الحيوان الذي يُلقب بسفينة الصحراء؟', a: ['الحصان', 'الجمل', 'الفيل', 'الأسد'], correct: 2 },
  { q: 'كم ضلعًا للمثلث؟', a: ['2', '3', '4', '5'], correct: 2 },
  { q: 'ما أكبر محيط في العالم؟', a: ['الأطلسي', 'الهندي', 'الهادئ', 'المتجمد'], correct: 3 },
  { q: 'ما ناتج 9 × 8؟', a: ['64', '72', '81', '96'], correct: 2 },
  { q: 'أي لغة تُستخدم لبناء صفحات الويب؟', a: ['HTML', 'MP3', 'PDF', 'PNG'], correct: 1 },
  { q: 'كم عدد ألوان قوس قزح؟', a: ['5', '6', '7', '8'], correct: 3 },
  { q: 'من هو أول الخلفاء الراشدين؟', a: ['عمر بن الخطاب', 'عثمان بن عفان', 'علي بن أبي طالب', 'أبو بكر الصديق'], correct: 4 },
  { q: 'ما أسرع حيوان بري؟', a: ['الفهد', 'النمر', 'الحصان', 'الذئب'], correct: 1 },
  { q: 'ما الغاز الذي نتنفسه؟', a: ['الهيدروجين', 'الأكسجين', 'النيتروجين', 'الكربون'], correct: 2 },
  { q: 'كم شهرًا في السنة؟', a: ['10', '11', '12', '13'], correct: 3 },
  { q: 'ما عاصمة السعودية؟', a: ['جدة', 'الرياض', 'مكة', 'الدمام'], correct: 2 },
  { q: 'ما أكبر قارة في العالم؟', a: ['أفريقيا', 'أوروبا', 'آسيا', 'أمريكا'], correct: 3 },
  { q: 'أي معدن رمزه Au؟', a: ['الفضة', 'الحديد', 'الذهب', 'النحاس'], correct: 3 },
  { q: 'كم دقيقة في الساعة؟', a: ['30', '45', '60', '90'], correct: 3 },
  { q: 'ما عكس كلمة سريع؟', a: ['كبير', 'بطيء', 'قوي', 'خفيف'], correct: 2 },
  { q: 'ما اسم صوت الأسد؟', a: ['نعيق', 'زئير', 'مواء', 'نباح'], correct: 2 },
  { q: 'أي شهر يأتي بعد رمضان؟', a: ['شعبان', 'شوال', 'ذو القعدة', 'محرم'], correct: 2 },
  { q: 'ما عاصمة الإمارات؟', a: ['دبي', 'أبوظبي', 'الشارقة', 'العين'], correct: 2 },
  { q: 'كم عدد حروف اللغة العربية؟', a: ['26', '28', '29', '30'], correct: 2 },
  { q: 'ما الحيوان الذي يبيض ولا يلد؟', a: ['القطة', 'الدجاجة', 'البقرة', 'الحصان'], correct: 2 },
  { q: 'ما أكبر كوكب في المجموعة الشمسية؟', a: ['الأرض', 'المشتري', 'نبتون', 'الزهرة'], correct: 2 },
  { q: 'ما عاصمة الأردن؟', a: ['عمّان', 'بيروت', 'القدس', 'بغداد'], correct: 1 },
  { q: 'كم ثانية في الدقيقة؟', a: ['30', '45', '60', '100'], correct: 3 },
  { q: 'ما لون الزمرد؟', a: ['أزرق', 'أحمر', 'أخضر', 'أصفر'], correct: 3 },
  { q: 'ما البحر الذي يفصل بين السعودية ومصر؟', a: ['البحر الأحمر', 'البحر الأسود', 'بحر العرب', 'المتوسط'], correct: 1 },
  { q: 'من كتب مسرحية روميو وجولييت؟', a: ['شكسبير', 'المتنبي', 'نجيب محفوظ', 'دانتي'], correct: 1 },
  { q: 'ما عاصمة المغرب؟', a: ['الدار البيضاء', 'فاس', 'الرباط', 'مراكش'], correct: 3 },
  { q: 'كم لاعبًا في فريق كرة القدم داخل الملعب؟', a: ['9', '10', '11', '12'], correct: 3 },
  { q: 'ما العضو المسؤول عن ضخ الدم؟', a: ['الرئة', 'القلب', 'الكبد', 'المعدة'], correct: 2 },
  { q: 'ما اسم صوت الكلب؟', a: ['مواء', 'نباح', 'صهيل', 'زئير'], correct: 2 },
  { q: 'ما عاصمة العراق؟', a: ['البصرة', 'الموصل', 'بغداد', 'أربيل'], correct: 3 },
  { q: 'ما ناتج 15 + 27؟', a: ['40', '42', '44', '45'], correct: 2 },
  { q: 'أي حاسة نستخدمها لرؤية الألوان؟', a: ['السمع', 'الشم', 'البصر', 'اللمس'], correct: 3 },
  { q: 'ما وحدة قياس درجة الحرارة الشائعة؟', a: ['المتر', 'الجرام', 'الدرجة المئوية', 'اللتر'], correct: 3 },
  { q: 'ما عاصمة لبنان؟', a: ['بيروت', 'طرابلس', 'صيدا', 'زحلة'], correct: 1 },
  { q: 'ما اسم أكبر حيوان على الأرض؟', a: ['الفيل', 'الحوت الأزرق', 'الزرافة', 'القرش'], correct: 2 },
  { q: 'ما ناتج 100 ÷ 4؟', a: ['20', '25', '30', '40'], correct: 2 },
  { q: 'ما عاصمة سوريا؟', a: ['حلب', 'حمص', 'دمشق', 'اللاذقية'], correct: 3 },
  { q: 'أي كوكب أقرب إلى الشمس؟', a: ['الزهرة', 'الأرض', 'عطارد', 'المريخ'], correct: 3 },
  { q: 'ما اسم صغير الأسد؟', a: ['جرو', 'شبل', 'مهر', 'حمل'], correct: 2 },
  { q: 'كم عدد قارات العالم؟', a: ['5', '6', '7', '8'], correct: 3 },
  { q: 'ما عاصمة الكويت؟', a: ['الكويت', 'حولي', 'الفروانية', 'الجهراء'], correct: 1 },
  { q: 'ما الجهاز الذي يقيس الزلازل؟', a: ['البارومتر', 'السيزموجراف', 'الترمومتر', 'البوصلة'], correct: 2 },
  { q: 'ما ناتج 12 × 12؟', a: ['124', '132', '144', '156'], correct: 3 },
  { q: 'ما عاصمة قطر؟', a: ['الدوحة', 'الريان', 'الوكرة', 'الخور'], correct: 1 },
  { q: 'ما المعدن السائل في درجة حرارة الغرفة؟', a: ['الحديد', 'الذهب', 'الزئبق', 'الألمنيوم'], correct: 3 },
  { q: 'أي طائر لا يستطيع الطيران؟', a: ['الصقر', 'النعامة', 'الحمامة', 'النسر'], correct: 2 },
  { q: 'ما عاصمة الجزائر؟', a: ['وهران', 'قسنطينة', 'الجزائر', 'عنابة'], correct: 3 },
  { q: 'ما اسم الكوكب ذي الحلقات الشهيرة؟', a: ['زحل', 'المريخ', 'عطارد', 'الأرض'], correct: 1 },
  { q: 'ما ناتج 7 تربيع؟', a: ['14', '21', '49', '77'], correct: 3 },
  { q: 'ما عاصمة تونس؟', a: ['صفاقس', 'سوسة', 'تونس', 'بنزرت'], correct: 3 },
  { q: 'ما اسم العملية التي تصنع بها النباتات غذاءها؟', a: ['التنفس', 'البناء الضوئي', 'التبخر', 'الهضم'], correct: 2 },
  { q: 'ما عاصمة فلسطين؟', a: ['القدس', 'غزة', 'رام الله', 'يافا'], correct: 1 },
  { q: 'ما الحيوان الذي يملك خرطومًا؟', a: ['وحيد القرن', 'الفيل', 'فرس النهر', 'الدب'], correct: 2 },
  { q: 'ما ناتج 50% من 80؟', a: ['20', '30', '40', '50'], correct: 3 },
  { q: 'أي مادة تتجمد عند صفر مئوية؟', a: ['الزيت', 'الماء', 'الهواء', 'السكر'], correct: 2 },
  { q: 'ما عاصمة سلطنة عمان؟', a: ['صلالة', 'مسقط', 'نزوى', 'صحار'], correct: 2 },
  { q: 'أي رياضة تستخدم مضربًا وكرة صفراء؟', a: ['كرة القدم', 'التنس', 'السباحة', 'الجودو'], correct: 2 },
  { q: 'ما اسم الشكل الذي له أربعة أضلاع متساوية؟', a: ['المثلث', 'الدائرة', 'المربع', 'المخمس'], correct: 3 },
  { q: 'ما عاصمة ليبيا؟', a: ['بنغازي', 'طرابلس', 'مصراتة', 'سبها'], correct: 2 },
  { q: 'ما العنصر الضروري للتنفس؟', a: ['الأكسجين', 'الذهب', 'الحديد', 'الملح'], correct: 1 },
  { q: 'ما اسم صغير القطة؟', a: ['هرّ', 'شبل', 'جرو', 'عجل'], correct: 1 },
  { q: 'كم يومًا في السنة العادية؟', a: ['364', '360', '365', '366'], correct: 3 },
  { q: 'ما عاصمة السودان؟', a: ['الخرطوم', 'أم درمان', 'بورتسودان', 'كسلا'], correct: 1 },
  { q: 'ما اسم الجهاز الذي يعرض الصور على الحائط؟', a: ['البروجكتور', 'الميكروفون', 'السماعة', 'الماسح'], correct: 1 },
  { q: 'ما ناتج 11 × 11؟', a: ['111', '121', '131', '141'], correct: 2 },
  { q: 'أي حيوان يعيش في الماء ويتنفس بالخياشيم؟', a: ['السمك', 'القط', 'الحصان', 'النسر'], correct: 1 },
  { q: 'ما عاصمة اليمن؟', a: ['عدن', 'صنعاء', 'تعز', 'الحديدة'], correct: 2 },
  { q: 'ما اسم صوت الحصان؟', a: ['صهيل', 'نباح', 'مواء', 'نقيق'], correct: 1 },
  { q: 'ما أقرب نجم إلى الأرض؟', a: ['القمر', 'الشمس', 'الشعرى', 'المريخ'], correct: 2 },
  { q: 'ما عاصمة البحرين؟', a: ['المنامة', 'المحرق', 'الرفاع', 'حمد'], correct: 1 },
  { q: 'ما اسم علم دراسة الطقس؟', a: ['الأحياء', 'الأرصاد الجوية', 'الفلك', 'الجيولوجيا'], correct: 2 },
  { q: 'ما ناتج 81 ÷ 9؟', a: ['7', '8', '9', '10'], correct: 3 },
  { q: 'أي لون ينتج من مزج الأزرق والأصفر؟', a: ['برتقالي', 'أخضر', 'بنفسجي', 'بني'], correct: 2 },
  { q: 'ما عاصمة موريتانيا؟', a: ['نواكشوط', 'نواذيبو', 'أطار', 'روصو'], correct: 1 },
  { q: 'ما اسم أكبر صحراء حارة في العالم؟', a: ['جوبي', 'الصحراء الكبرى', 'الربع الخالي', 'كالهاري'], correct: 2 },
  { q: 'أي شهر عدد أيامه 28 غالبًا؟', a: ['يناير', 'فبراير', 'مارس', 'أبريل'], correct: 2 },
  { q: 'ما عاصمة الصومال؟', a: ['مقديشو', 'هرجيسا', 'بربرة', 'كيسمايو'], correct: 1 },
  { q: 'ما اسم الخط الذي يقسم الأرض إلى نصفين؟', a: ['خط جرينتش', 'خط الاستواء', 'مدار السرطان', 'خط التاريخ'], correct: 2 },
  { q: 'ما الحيوان المعروف بذاكرته القوية؟', a: ['الفيل', 'الأرنب', 'الضفدع', 'الدجاجة'], correct: 1 },
  { q: 'كم عدد أسنان الإنسان البالغ غالبًا؟', a: ['28', '30', '32', '36'], correct: 3 },
  { q: 'ما عاصمة جزر القمر؟', a: ['موروني', 'جيبوتي', 'مالابو', 'فيكتوريا'], correct: 1 },
  { q: 'ما الأداة المستخدمة لمعرفة الاتجاهات؟', a: ['البوصلة', 'المسطرة', 'الميزان', 'المجهر'], correct: 1 },
  { q: 'ما ناتج 6 × 7؟', a: ['36', '42', '48', '56'], correct: 2 },
  { q: 'أي عضو يساعد على التنفس؟', a: ['الرئتان', 'الكليتان', 'العينان', 'الأذنان'], correct: 1 },
  { q: 'ما عاصمة جيبوتي؟', a: ['جيبوتي', 'هرجيسا', 'أسمرة', 'مقديشو'], correct: 1 },
  { q: 'ما اسم صغير الكلب؟', a: ['جرو', 'شبل', 'مهر', 'كتكوت'], correct: 1 },
  { q: 'ما لون الياقوت الشائع؟', a: ['أحمر', 'أخضر', 'أبيض', 'أسود'], correct: 1 },
  { q: 'ما عاصمة تركيا؟', a: ['إسطنبول', 'أنقرة', 'إزمير', 'بورصة'], correct: 2 },
  { q: 'ما أكبر عضو في جسم الإنسان؟', a: ['القلب', 'الجلد', 'الكبد', 'الرئة'], correct: 2 },
  { q: 'ما ناتج 1000 - 275؟', a: ['625', '725', '775', '825'], correct: 2 },
]

const veryHardQuestions = [
  { q: 'ما المدينة التي يقع فيها برج إيفل؟', answer: 'باريس' },
  { q: 'ما اسم العالم الذي وضع قوانين الحركة الثلاثة؟', answer: 'إسحاق نيوتن' },
  { q: 'ما العنصر الكيميائي الذي رمزه Fe؟', answer: 'الحديد' },
  { q: 'ما اسم أعمق نقطة معروفة في محيطات العالم؟', answer: 'خندق ماريانا' },
  { q: 'ما الدولة التي تُعرف بأرض الألف بحيرة؟', answer: 'فنلندا' },
  { q: 'ما اسم أول إنسان صعد إلى الفضاء؟', answer: 'يوري غاغارين' },
  { q: 'ما السورة التي لا تبدأ بالبسملة؟', answer: 'التوبة' },
  { q: 'ما اسم الوحدة الأساسية لقياس شدة التيار الكهربائي؟', answer: 'الأمبير' },
  { q: 'ما المدينة التي كانت عاصمة الدولة العباسية؟', answer: 'بغداد' },
  { q: 'ما اسم الظاهرة التي يتحول فيها الماء من سائل إلى غاز؟', answer: 'التبخر' },
]

function cleanName(m) {
  return (m.pushName || m.name || m.sender?.split('@')[0] || 'عضو').slice(0, 22)
}
function mention(jid) { return '@' + jid.split('@')[0] }
function teamName(team) { return team === 'girls' ? '👧 البنات' : '👦 الشباب' }
function scoreText(g) { return `👧 البنات: *${g.scores.girls}* نقطة\n👦 الشباب: *${g.scores.boys}* نقطة` }
function playersText(g) {
  const girls = Object.values(g.players).filter(p => p.team === 'girls').map(p => `• ${p.name}`).join('\n') || 'لا يوجد'
  const boys = Object.values(g.players).filter(p => p.team === 'boys').map(p => `• ${p.name}`).join('\n') || 'لا يوجد'
  return `👧 *فريق البنات*\n${girls}\n\n👦 *فريق الشباب*\n${boys}`
}
function difficultyForRound(round) {
  if (round <= 5) return '🟢 سهل'
  if (round <= 10) return '🟡 متوسط'
  if (round <= 12) return '🟠 صعب'
  return '🔴 صعب جدًا'
}
function poolForRound(round) {
  if (round <= 5) return questions.slice(0, 40)
  if (round <= 10) return questions.slice(40, 75)
  if (round <= 12) return questions.slice(75)
  return veryHardQuestions
}
function normalizeAnswer(value) {
  return String(value || '').toLowerCase().trim()
    .replace(/[ًٌٍَُِّْـ]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه')
    .replace(/[؟?!،,.]/g, '').replace(/\s+/g, ' ')
}
function newQuestion(g) {
  const pool = poolForRound(g.questionNo + 1)
  let q
  do q = pool[Math.floor(Math.random() * pool.length)]
  while (g.used.includes(q.q) && g.used.length < questions.length)
  g.used.push(q.q)
  g.question = q
  g.questionNo++
  g.answered = false
}
function questionText(g, prefix) {
  const q = g.question
  return `╭──「 🧠 السؤال ${g.questionNo}/${g.maxQuestions} 」──╮\n│ الصعوبة: ${difficultyForRound(g.questionNo)}\n│ ${q.q}\n╰──────────────────╯\n\nأول شخص يرسل اسم الإجابة الصحيحة يربح نقطة.\nاكتبوا الإجابة فقط، مثال: *باريس*`
}

let handler = async (m, { args, usedPrefix, command }) => {
  if (!m.isGroup) return m.reply('❌ هذه اللعبة تعمل داخل الجروبات فقط.')
  const chat = m.chat
  const sender = m.sender
  const prefix = usedPrefix || '.'
  const rawAction = String(command || '').toLowerCase()
  const action = rawAction === 'مساعدة_التحدي' ? 'مساعدة' : rawAction.replace(/^تحدي[_-]/, '')
  const arg = String(args?.[0] || '').toLowerCase()
  let g = games.get(chat)

  if (/^(تحدي|تحدى|challenge)$/i.test(action)) {
    if (g) return m.reply(`⚠️ يوجد تحدي قائم بالفعل.\n${scoreText(g)}\nاكتب ${prefix}تحدي_انضم بنت أو ${prefix}تحدي_انضم ولد.`)
    g = { players: {}, scores: { girls: 0, boys: 0 }, maxQuestions: 15, questionNo: 0, used: [], question: null, answered: false, started: false, host: sender, startedAt: Date.now(), winner: null, verdict: null }
    games.set(chat, g)
    return m.reply(`╭──「 🎯 تحدي البنات والشباب 」──╮\n│ تم فتح التسجيل!\n│ كل عضو يختار فريقه.\n╰──────────────────╯\n\nللانضمام:\n👧 ${prefix}تحدي_انضم بنت\n👦 ${prefix}تحدي_انضم ولد\n\nبعد انضمام اللاعبين اكتب ${prefix}تحدي_ابدأ\nعدد الجولات: *15*`)
  }

  if (!g) return m.reply(`لا يوجد تحدي حالي. اكتب ${prefix}تحدي لبدء التسجيل.`)

  if (/^(انضم|join)$/i.test(action)) {
    if (g.started) return m.reply('❌ بدأ التحدي، لا يمكن الانضمام الآن.')
    const team = /^(بنت|بنات|girls|girl)$/i.test(arg) ? 'girls' : /^(ولد|شباب|boys|boy)$/i.test(arg) ? 'boys' : null
    if (!team) return m.reply(`اختر فريقك: ${prefix}تحدي_انضم بنت أو ${prefix}تحدي_انضم ولد`)
    g.players[sender] = { team, name: cleanName(m), points: 0 }
    return m.reply(`✅ انضم *${cleanName(m)}* إلى ${teamName(team)}!\n\n${playersText(g)}`)
  }

  if (/^(قائمة|اللاعبين|players)$/i.test(action)) return m.reply(`👥 *اللاعبون المسجلون*\n\n${playersText(g)}\n\n${scoreText(g)}`)

  if (/^(ابدأ|start)$/i.test(action)) {
    if (g.started) return m.reply('التحدي بدأ بالفعل!')
    const count = Object.keys(g.players).length
    if (count < 2) return m.reply('❌ يلزم لاعبان على الأقل، ويفضل وجود لاعب من كل فريق.')
    if (!Object.values(g.players).some(p => p.team === 'girls') || !Object.values(g.players).some(p => p.team === 'boys')) return m.reply('❌ يجب أن ينضم لاعب واحد على الأقل من البنات ولاعب من الشباب.')
    g.started = true; newQuestion(g)
    return m.reply(`🔥 بدأ التحدي!\n\n${scoreText(g)}\n\n${questionText(g, prefix)}`)
  }

  if (/^(سؤال|السؤال|next|التالي)$/i.test(action)) {
    if (!g.started) return m.reply(`لم يبدأ التحدي. اكتب ${prefix}تحدي_ابدأ`)
    if (g.question && !g.answered) return m.reply(`السؤال الحالي لم تتم الإجابة عليه بعد:\n\n${questionText(g, prefix)}`)
    if (g.questionNo >= g.maxQuestions) return m.reply(`انتهت الجولات! اكتب ${prefix}تحدي_نتيجة`)
    newQuestion(g)
    return m.reply(questionText(g, prefix))
  }

  if (/^(جاوب|اجابة|إجابة|answer)$/i.test(action)) {
    if (!g.started) return m.reply(`لم يبدأ التحدي. اكتب ${prefix}تحدي_ابدأ`)
    if (g.answered) return m.reply(`تمت الإجابة عن هذا السؤال. اكتب ${prefix}تحدي_سؤال للسؤال التالي.`)
    const player = g.players[sender]
    if (!player) return m.reply(`يجب أن تنضم لفريق أولًا: ${prefix}تحدي_انضم بنت أو ${prefix}تحدي_انضم ولد`)
    const answer = normalizeAnswer(args.join(' '))
    const correctAnswer = normalizeAnswer(g.question.answer || g.question.a[g.question.correct - 1])
    if (!answer) return m.reply(`اكتب اسم الإجابة فقط. مثال: ${prefix}تحدي_جاوب باريس`)
    if (answer !== correctAnswer) {
      return m.reply(`❌ إجابة خاطئة يا ${cleanName(m)}! حاولوا قبل أن يسبقكم فريق آخر.`)
    }
    g.answered = true; g.scores[player.team]++; player.points++
    try { awardGamePoint(global.db, chat, sender, 1) } catch (error) { console.error('[game leaderboard]', error?.message || error) }
    const earned = `✅ إجابة صحيحة! الفائز: *${cleanName(m)}* من ${teamName(player.team)}\n🏆 +1 نقطة لـ ${teamName(player.team)}\n\n${scoreText(g)}`
    if (g.questionNo >= g.maxQuestions) {
      const tied = g.scores.girls === g.scores.boys
      const winner = tied ? null : g.scores.girls > g.scores.boys ? 'girls' : 'boys'
      g.winner = winner
      const ending = tied
        ? `🤝 انتهت المسابقة بالتعادل!\n\n${scoreText(g)}\n\nيمكنكم عمل جولة كسر تعادل بكتابة ${prefix}تحدي_سؤال.`
        : `🏆 انتهت المسابقة!\n\n👑 الفريق الفائز: *${teamName(winner)}*\n😈 يحق للفريق الفائز الآن وضع حكم على الفريق الآخر:
${prefix}تحدي_حكم [اكتبوا الحكم هنا]`
      return m.reply(`${earned}\n\n${ending}`)
    }
    newQuestion(g)
    return m.reply(`${earned}\n\n${questionText(g, prefix)}`)
  }

  if (/^(نتيجة|النتائج|score|scores)$/i.test(action)) {
    if (!g.started) return m.reply(`التسجيل مستمر ولم يبدأ التحدي بعد. اكتب ${prefix}تحدي_ابدأ`)
    const tied = g.scores.girls === g.scores.boys
    const winner = tied ? null : g.scores.girls > g.scores.boys ? 'girls' : 'boys'
    if (g.questionNo < g.maxQuestions && !arg) return m.reply(`📊 النتيجة الحالية بعد ${g.questionNo} جولات:\n\n${scoreText(g)}\n\nباقي ${g.maxQuestions - g.questionNo} جولات.`)
    if (!winner) return m.reply(`🤝 تعادل!\n\n${scoreText(g)}\n\nاكتب ${prefix}تحدي_سؤال لجولة كسر التعادل.`)
    g.winner = winner
    return m.reply(`🏆 *انتهى التحدي!*\n\n${scoreText(g)}\n\n👑 الفائزون: ${teamName(winner)}\n😈 يحق للفائزين الآن كتابة الحكم:\n${prefix}تحدي_حكم [اكتبوا التحدي على الفريق الخاسر]`)
  }

  if (/^(حكم|الحكم|verdict)$/i.test(action)) {
    if (!g.winner) return m.reply(`أعلنوا النتيجة أولًا باستخدام ${prefix}تحدي_نتيجة نهائي`)
    const verdict = args.slice(0).join(' ').trim()
    if (!verdict) return m.reply(`مثال: ${prefix}تحدي_حكم غنوا مقطعًا من أغنية\nأو: ${prefix}تحدي_حكم أرسلوا صورة مضحكة`)
    g.verdict = verdict
    const loser = g.winner === 'girls' ? 'boys' : 'girls'
    return m.reply(`📜 *الحكم الرسمي*\n\n👑 ${teamName(g.winner)} يحكمون على ${teamName(loser)}:\n\n🎭 ${verdict}\n\nعلى الفريق الخاسر تنفيذ الحكم بروح رياضية!`)
  }

  if (/^(انهاء|إلغاء|الغاء|stop)$/i.test(action)) {
    games.delete(chat)
    return m.reply('🛑 تم إنهاء التحدي وحذف نتيجته.')
  }

  if (/^(مساعدة|help)$/i.test(action)) return m.reply(`🎯 *أوامر تحدي البنات والشباب*\n\n${prefix}تحدي — فتح تحدي جديد\n${prefix}تحدي_انضم بنت\n${prefix}تحدي_انضم ولد\n${prefix}تحدي_ابدأ — بدء الأسئلة\n${prefix}تحدي_جاوب باريس — اكتب اسم الإجابة فقط\n${prefix}تحدي_سؤال — السؤال التالي\n${prefix}تحدي_نتيجة — عرض النقاط\n${prefix}تحدي_حكم [النص] — حكم الفريق الفائز\n${prefix}تحدي_قائمة — اللاعبون\n${prefix}تحدي_انهاء — إنهاء التحدي`)

  return m.reply(`أمر غير معروف. اكتب ${prefix}مساعدة_التحدي لرؤية أوامر التحدي.`)
}

// استقبال الإجابات المباشرة بدون أمر: يكتب اللاعب "باريس" فقط.
handler.all = async (m) => {
  if (!m.isGroup || !m.text) return
  const g = games.get(m.chat)
  if (!g || !g.started || g.answered || !g.question) return
  if (String(m.text).trim().startsWith('.') || String(m.text).trim().startsWith('!')) return

  const player = g.players[m.sender]
  if (!player) return
  const answer = normalizeAnswer(m.text)
  const correctAnswer = normalizeAnswer(g.question.answer || g.question.a[g.question.correct - 1])
  if (!answer || answer !== correctAnswer) return

  g.answered = true
  g.scores[player.team]++
  player.points++
  try { awardGamePoint(global.db, m.chat, m.sender, 1) } catch (error) { console.error('[game leaderboard]', error?.message || error) }
  const earned = `✅ إجابة صحيحة! الفائز: *${cleanName(m)}* من ${teamName(player.team)}\n🏆 +1 نقطة لـ ${teamName(player.team)}\n\n${scoreText(g)}`
  if (g.questionNo >= g.maxQuestions) {
    const tied = g.scores.girls === g.scores.boys
    const winner = tied ? null : g.scores.girls > g.scores.boys ? 'girls' : 'boys'
    g.winner = winner
    const ending = tied
      ? `🤝 انتهت المسابقة بالتعادل!\n\nيمكنكم عمل جولة كسر تعادل بكتابة .سؤال.`
      : `🏆 انتهت المسابقة!\n\n👑 الفريق الفائز: *${teamName(winner)}*\n😈 يحق للفريق الفائز وضع حكم:\n.حكم [اكتبوا الحكم هنا]`
    return m.reply(`${earned}\n\n${ending}`)
  }
  newQuestion(g)
  return m.reply(`${earned}\n\n${questionText(g, '.')}`)
}

handler.help = ['تحدي', 'تحدي_انضم بنت', 'تحدي_انضم ولد', 'تحدي_ابدأ', 'تحدي_جاوب 1', 'تحدي_نتيجة', 'تحدي_حكم']
handler.tags = ['games']
handler.command = /^(تحدي|تحدى|challenge|تحدي_انضم|تحدي_قائمة|تحدي_اللاعبين|تحدي_ابدأ|تحدي_سؤال|تحدي_التالي|تحدي_جاوب|تحدي_اجابة|تحدي_إجابة|تحدي_نتيجة|تحدي_حكم|تحدي_الحكم|تحدي_انهاء|تحدي_إلغاء|تحدي_الغاء|تحدي_stop|مساعدة_التحدي)$/i

export default handler
