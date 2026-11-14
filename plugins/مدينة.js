// 🌑 مدينة الظلال — لعبة RPG نصية تعمل مباشرة داخل واتساب
// لا تحتاج AIRich أو HTML أو أي مكتبة إضافية.

const monsters = [
  { name: 'غول الكهف', icon: '👹', hp: 45, atk: 8, def: 2, xp: 28, gold: 18, loot: 'جلد الغول' },
  { name: 'ذئب الظلام', icon: '🐺', hp: 34, atk: 10, def: 1, xp: 24, gold: 15, loot: 'ناب الذئب' },
  { name: 'ساحر الرماد', icon: '🧙', hp: 55, atk: 13, def: 4, xp: 42, gold: 32, loot: 'بلورة الرماد' },
  { name: 'حارس المقبرة', icon: '💀', hp: 68, atk: 15, def: 6, xp: 58, gold: 45, loot: 'عظمة مسحورة' },
  { name: 'تنين صغير', icon: '🐉', hp: 110, atk: 22, def: 10, xp: 120, gold: 100, loot: 'قلب تنين' },
]

const weapons = {
  عصا: { name: 'عصا المبتدئ', icon: '🪄', atk: 3, price: 0 },
  سيف: { name: 'سيف حديدي', icon: '⚔️', atk: 8, price: 120 },
  فأس: { name: 'فأس المحارب', icon: '🪓', atk: 14, price: 280 },
  برق: { name: 'نصل البرق', icon: '⚡', atk: 23, price: 650 },
}

const armors = {
  قماش: { name: 'رداء قديم', icon: '🥋', def: 1, price: 0 },
  جلد: { name: 'درع جلدي', icon: '🛡️', def: 5, price: 100 },
  حديد: { name: 'درع حديدي', icon: '🛡️', def: 11, price: 320 },
  ظل: { name: 'درع الظلال', icon: '🌑', def: 20, price: 800 },
}

const locations = [
  ['🌲 غابة الهمس', 'مكان مليء بالذئاب والكنوز الضائعة'],
  ['🪦 مقبرة الغربان', 'أرواح قديمة وحارس لا ينام'],
  ['🕳️ كهوف الرماد', 'بلورات نادرة ومخلوقات شرسة'],
  ['🏰 قلعة الظلام', 'الطريق الأخير إلى التنين'],
]

function newHero() {
  return {
    level: 1, xp: 0, gold: 80, hp: 100, maxHp: 100, energy: 10, maxEnergy: 10,
    weapon: 'عصا', armor: 'قماش', location: 0, wins: 0, losses: 0,
    inventory: { 'جرعة صحة': 2, 'جلد الغول': 0, 'ناب الذئب': 0, 'بلورة الرماد': 0, 'عظمة مسحورة': 0, 'قلب تنين': 0 },
    skills: { ضربة_قوية: 0, علاج: 0, برق: 0 },
    quest: { name: 'بداية الطريق', target: 'wins', need: 3, progress: 0, reward: 100, done: false },
    combat: null,
    lastWork: 0,
  }
}

function ensureHero(user) {
  if (!user.shadowCity) user.shadowCity = newHero()
  const h = user.shadowCity
  h.inventory ||= {}
  h.skills ||= { ضربة_قوية: 0, علاج: 0, برق: 0 }
  h.quest ||= { name: 'بداية الطريق', target: 'wins', need: 3, progress: 0, reward: 100, done: false }
  h.weapon ||= 'عصا'; h.armor ||= 'قماش'; h.level ||= 1; h.gold ||= 0
  h.maxHp ||= 100; h.maxEnergy ||= 10; h.hp = Math.min(h.hp ?? h.maxHp, h.maxHp)
  return h
}

function xpNeed(level) { return 70 + (level - 1) * 55 }
function weapon(h) { return weapons[h.weapon] || weapons.عصا }
function armor(h) { return armors[h.armor] || armors.قماش }
function bar(value, max, size = 12) {
  const filled = Math.max(0, Math.min(size, Math.round((value / max) * size)))
  return '█'.repeat(filled) + '░'.repeat(size - filled)
}
function fmt(h) {
  return `❤️ ${h.hp}/${h.maxHp}  ⚡ ${h.energy}/${h.maxEnergy}  🪙 ${h.gold}`
}
function levelUp(h) {
  const messages = []
  while (h.xp >= xpNeed(h.level)) {
    h.xp -= xpNeed(h.level); h.level++
    h.maxHp += 15; h.maxEnergy += 2; h.hp = h.maxHp; h.energy = h.maxEnergy
    messages.push(`🎉 ارتقيت إلى المستوى *${h.level}*! زادت قوتك وصحتك.`)
  }
  return messages.join('\n')
}
function itemList(h) {
  return Object.entries(h.inventory).filter(([, n]) => n > 0).map(([k, n]) => `│ ${k}: ${n}`).join('\n') || '│ الحقيبة فارغة'
}
function help(prefix) {
  return `╭──「 🌑 مدينة الظلال 」──╮
│ ${prefix}مدينة — القائمة الرئيسية
│ ${prefix}شخصيتي — معلومات بطلك
│ ${prefix}خريطة — المناطق المتاحة
│ ${prefix}استكشف — ابحث عن خطر أو كنز
│ ${prefix}قاتل — هاجم الوحش
│ ${prefix}مهارة ضربة_قوية — هجوم قوي
│ ${prefix}مهارة علاج — استعمل العلاج
│ ${prefix}حقيبتي — أغراضك
│ ${prefix}متجر — الأسلحة والدروع
│ ${prefix}اشتري سيف — شراء وتجهيز
│ ${prefix}مهمة — مهمتك الحالية
│ ${prefix}اعمل — اجمع ذهبًا
│ ${prefix}ترتيب — ترتيبك الشخصي
│ ${prefix}انسحاب — اخرج من القتال
╰──────────────────╯`
}

let handler = async (m, { conn, user, args, usedPrefix, command }) => {
  const h = ensureHero(user)
  const action = String(command || '').toLowerCase()
  const arg = String(args?.[0] || '').toLowerCase()
  const prefix = usedPrefix || '.'

  if (/^(مدينة|مدينة_الظلال|shadowcity|ظلال)$/i.test(action)) return m.reply(help(prefix))

  if (/^(شخصيتي|بطلي|profile|بروفايل)$/i.test(action)) {
    const w = weapon(h), a = armor(h)
    return m.reply(`╭──「 🧙 شخصيتك 」──╮
│ المستوى: *${h.level}*  | الخبرة: ${h.xp}/${xpNeed(h.level)}
│ ${fmt(h)}
│ الصحة: ${bar(h.hp, h.maxHp)}
│ الهجوم: *${h.level * 2 + w.atk}* ${w.icon} ${w.name}
│ الدفاع: *${h.level + a.def}* ${a.icon} ${a.name}
│ انتصارات: ${h.wins}  | هزائم: ${h.losses}
╰──────────────────╯`)
  }

  if (/^(خريطة|المناطق|map)$/i.test(action)) {
    return m.reply(`🗺️ *خريطة مدينة الظلال*\n\n` + locations.map((x, i) => `${i === h.location ? '📍' : '▫️'} ${i + 1}. *${x[0]}* — ${x[1]}`).join('\n') + `\n\nاستخدم ${prefix}استكشف للذهاب في مغامرة.`)
  }

  if (/^(حقيبتي|حقيبة|inventory|inv)$/i.test(action)) return m.reply(`🎒 *حقيبتك*\n\n${itemList(h)}\n\n${fmt(h)}`)

  if (/^(مهمة|مهمتي|quest)$/i.test(action)) {
    const q = h.quest
    return m.reply(`📜 *${q.name}*\n\nالهدف: ${q.target === 'wins' ? 'اهزم' : 'اجمع'} ${q.need}\nالتقدم: ${q.progress}/${q.need}\nالمكافأة: 🪙 ${q.reward}\nالحالة: ${q.done ? '✅ مكتملة' : '⏳ مستمرة'}`)
  }

  if (/^(متجر|shop)$/i.test(action)) return m.reply(`🏪 *متجر الحداد*\n\n⚔️ الأسلحة:\n${Object.entries(weapons).map(([k, v]) => `• ${k}: ${v.icon} +${v.atk} هجوم — 🪙 ${v.price}`).join('\n')}\n\n🛡️ الدروع:\n${Object.entries(armors).map(([k, v]) => `• ${k}: ${v.icon} +${v.def} دفاع — 🪙 ${v.price}`).join('\n')}\n\nللشراء: ${prefix}اشتري سيف`)

  if (/^(اشتري|شراء|buy)$/i.test(action)) {
    const w = weapons[arg], a = armors[arg]
    const item = w || a
    if (!item || item.price === 0) return m.reply(`اكتب اسم قطعة موجودة في المتجر. مثال: ${prefix}اشتري سيف`)
    if (h.gold < item.price) return m.reply(`❌ تحتاج ${item.price - h.gold} قطعة ذهب إضافية.`)
    h.gold -= item.price
    if (w) h.weapon = arg; else h.armor = arg
    return m.reply(`✅ اشتريت وجهزت ${item.icon} *${item.name}*\n${fmt(h)}`)
  }

  if (/^(اعمل|عمل|work)$/i.test(action)) {
    const wait = 5 * 60 * 1000 - (Date.now() - (h.lastWork || 0))
    if (wait > 0) return m.reply(`⏳ تعبت من العمل. انتظر ${Math.ceil(wait / 60000)} دقيقة.`)
    const earned = 25 + h.level * 8 + Math.floor(Math.random() * 20)
    h.gold += earned; h.lastWork = Date.now()
    return m.reply(`🔨 عملت في ورشة المدينة وكسبت *${earned}* 🪙\nرصيدك: ${h.gold}`)
  }

  if (/^(استكشف|مغامرة|explore)$/i.test(action)) {
    if (h.combat) return m.reply(`⚔️ أنت في قتال ضد ${h.combat.icon} *${h.combat.name}*. اكتب ${prefix}قاتل`)
    if (h.energy <= 0) return m.reply(`😮‍💨 طاقتك انتهت. استخدم ${prefix}اعمل أو انتظر قليلًا.`)
    h.energy--
    const roll = Math.random()
    if (roll < 0.18) {
      const gold = 20 + Math.floor(Math.random() * 50); h.gold += gold
      return m.reply(`🧰 وجدت صندوقًا مخفيًا في ${locations[h.location][0]}!\nحصلت على 🪙 *${gold}*.`)
    }
    if (roll < 0.28) {
      h.inventory['جرعة صحة'] = (h.inventory['جرعة صحة'] || 0) + 1
      return m.reply(`🧪 وجدت جرعة صحة في أطلال قديمة!\nأصبحت لديك ${h.inventory['جرعة صحة']} جرعة.`)
    }
    const base = monsters[Math.min(monsters.length - 1, Math.floor(Math.random() * (h.level >= 5 ? monsters.length : 4)))]
    const enemy = { ...base, maxHp: base.hp, hp: base.hp + h.level * 4 }
    h.combat = enemy
    return m.reply(`⚠️ ظهر ${enemy.icon} *${enemy.name}*!\n❤️ صحته: ${enemy.hp}/${enemy.maxHp}\n\nاكتب ${prefix}قاتل للهجوم أو ${prefix}مهارة ضربة_قوية`)
  }

  if (/^(قاتل|هجوم|attack|fight)$/i.test(action)) {
    if (!h.combat) return m.reply(`لا يوجد وحش أمامك. اكتب ${prefix}استكشف`)
    const e = h.combat, damage = Math.max(1, h.level * 2 + weapon(h).atk + Math.floor(Math.random() * 8) - e.def)
    e.hp -= damage
    if (e.hp <= 0) {
      h.wins++; h.gold += e.gold; h.xp += e.xp; h.combat = null
      if (h.quest.target === 'wins' && !h.quest.done) h.quest.progress++
      let extra = levelUp(h)
      if (h.quest.progress >= h.quest.need && !h.quest.done) { h.quest.done = true; h.gold += h.quest.reward; extra += `\n📜 أنجزت المهمة! +${h.quest.reward} 🪙` }
      return m.reply(`⚔️ قضيت على ${e.icon} *${e.name}*!\n💥 الضرر: ${damage}\n🎁 +${e.xp} خبرة و +${e.gold} ذهب\n${extra}\n\n${fmt(h)}`)
    }
    const taken = Math.max(1, e.atk + Math.floor(Math.random() * 5) - armor(h).def - h.level)
    h.hp -= taken
    if (h.hp <= 0) {
      h.hp = Math.floor(h.maxHp * 0.35); h.gold = Math.max(0, h.gold - 20); h.losses++; h.combat = null
      return m.reply(`💀 هزمك ${e.icon} *${e.name}*! خسرت 20 ذهب، وأنقذك أحد الحراس.\n${fmt(h)}\nحاول مرة أخرى بـ ${prefix}استكشف`)
    }
    return m.reply(`⚔️ ضربت ${e.name} وألحقت *${damage}* ضررًا.\n${e.icon} العدو: ${e.hp}/${e.maxHp}\n💔 تلقيت ${taken} ضررًا.\n${fmt(h)}\n\n${prefix}قاتل للهجوم مجددًا`)
  }

  if (/^(مهارة|skill)$/i.test(action)) {
    if (!h.combat && arg !== 'علاج') return m.reply(`لا توجد معركة. المهارة المتاحة خارج القتال: ${prefix}مهارة علاج`)
    if (arg === 'علاج') {
      if ((h.inventory['جرعة صحة'] || 0) < 1) return m.reply('❌ لا تملك جرعة صحة. ابحث عنها عبر الاستكشاف.')
      h.inventory['جرعة صحة']--; const heal = 35 + h.level * 5; h.hp = Math.min(h.maxHp, h.hp + heal)
      return m.reply(`🧪 استعملت جرعة واستعدت *${heal}* صحة.\n${fmt(h)}`)
    }
    if (arg === 'ضربة_قوية' || arg === 'قوية') {
      if (!h.combat) return m.reply('لا يوجد عدو.')
      const damage = h.level * 5 + weapon(h).atk * 2 + Math.floor(Math.random() * 8)
      h.combat.hp -= damage
      if (h.combat.hp <= 0) { const e = h.combat; h.wins++; h.gold += e.gold * 2; h.xp += e.xp * 2; h.combat = null; const up = levelUp(h); return m.reply(`💥 ضربة أسطورية! قضيت على ${e.icon} *${e.name}* وحصلت على ضعف المكافأة.\n${up}\n${fmt(h)}`) }
      return m.reply(`💥 ضربة قوية ألحقت *${damage}* ضررًا!\n${h.combat.icon} صحة العدو: ${h.combat.hp}/${h.combat.maxHp}`)
    }
    return m.reply(`المهارات: ${prefix}مهارة ضربة_قوية أو ${prefix}مهارة علاج`)
  }

  if (/^(انسحاب|هرب|run)$/i.test(action)) {
    if (!h.combat) return m.reply('لست داخل قتال.')
    if (Math.random() < 0.55) { h.combat = null; return m.reply('🏃 هربت من المعركة بنجاح.') }
    h.hp = Math.max(1, h.hp - 8); return m.reply(`❌ فشل الهروب وتلقيت 8 ضرر.\n${fmt(h)}`)
  }

  if (/^(ترتيب|rank|مستواي)$/i.test(action)) return m.reply(`🏆 ترتيبك الحالي\n\nالمستوى: *${h.level}*\nالخبرة: ${h.xp}/${xpNeed(h.level)}\nالانتصارات: *${h.wins}*\nالذهب: *${h.gold}*\n\nاستمر في الاستكشاف والقتال لتصبح سيد مدينة الظلال!`)

  return m.reply(`الأمر غير معروف. اكتب ${prefix}مدينة لرؤية جميع أوامر اللعبة.`)
}

handler.help = ['مدينة', 'استكشف', 'قاتل', 'شخصيتي', 'متجر', 'حقيبتي', 'مهمة', 'اعمل', 'خريطة']
handler.tags = ['games']
handler.command = /^(مدينة|مدينة_الظلال|shadowcity|ظلال|شخصيتي|بطلي|profile|بروفايل|خريطة|المناطق|map|حقيبتي|حقيبة|inventory|inv|مهمة|مهمتي|quest|متجر|shop|اشتري|شراء|buy|اعمل|عمل|work|استكشف|مغامرة|explore|قاتل|هجوم|attack|fight|مهارة|skill|انسحاب|هرب|run|ترتيب|rank|مستواي)$/i

export default handler