// 🎮 لعبة صيد الكنز — تعمل مباشرة داخل واتساب بدون HTML أو AIRich
const games = new Map()

const prizes = [
  { icon: '💰', name: 'كيس ذهب', points: 30 },
  { icon: '💎', name: 'جوهرة نادرة', points: 50 },
  { icon: '🪙', name: 'عملات قديمة', points: 20 },
  { icon: '🧰', name: 'صندوق أدوات', points: 10 },
]

function createGame() {
  const doors = [0, 1, 2].sort(() => Math.random() - 0.5)
  return { round: 1, score: 0, doors, startedAt: Date.now() }
}

function board(game) {
  return [1, 2, 3].map(n => `🚪 الباب ${n}`).join('   ')
}

let handler = async (m, { command, args, usedPrefix }) => {
  const key = m.sender || m.chat
  const action = String(command || '').toLowerCase()

  if (/^(كنز|صيد_الكنز|treasure)$/i.test(action)) {
    const game = createGame()
    games.set(key, game)
    return m.reply(
      `╭──「 🗺️ صيد الكنز 」──╮\n` +
      `│ أمامك 3 أبواب غامضة!\n` +
      `│ خلف باب واحد كنز ثمين.\n` +
      `│ لديك 5 جولات لجمع أكبر نقاط.\n` +
      `╰────────────────╯\n\n` +
      `${board(game)}\n\n` +
      `اكتب: *${usedPrefix}اختار 1* أو 2 أو 3\n` +
      `للخروج: *${usedPrefix}انسحب*`
    )
  }

  const game = games.get(key)
  if (!game) {
    return m.reply(`لا توجد لعبة نشطة. ابدأ لعبة جديدة بكتابة: *${usedPrefix}كنز*`)
  }

  if (/^(انسحب|انهاء|خروج|treasurequit)$/i.test(action)) {
    games.delete(key)
    return m.reply(`🏳️ انسحبت من اللعبة. مجموع نقاطك: *${game.score}*`)
  }

  if (/^(اختار|اختيار|باب|choose)$/i.test(action)) {
    const choice = Number(args?.[0])
    if (![1, 2, 3].includes(choice)) {
      return m.reply(`اختر بابًا صحيحًا: *${usedPrefix}اختار 1* أو *2* أو *3*`)
    }

    const prizeIndex = game.doors[choice - 1]
    const prize = prizes[prizeIndex % prizes.length]
    const isTreasure = prizeIndex === 0 || Math.random() > 0.35
    const gained = isTreasure ? prize.points : 0
    game.score += gained

    if (game.round >= 5) {
      games.delete(key)
      return m.reply(
        `${isTreasure ? `${prize.icon} وجدت ${prize.name}! +${gained} نقطة` : '🕸️ الباب كان فارغًا!'}\n\n` +
        `🏆 انتهت اللعبة!\n` +
        `⭐ مجموع نقاطك: *${game.score}*\n` +
        `${game.score >= 120 ? '👑 صياد كنوز أسطوري!' : game.score >= 70 ? '🔥 صياد ممتاز!' : '💪 حاول مرة أخرى لتحطم رقمك!'}\n\n` +
        `ابدأ من جديد: *${usedPrefix}كنز*`
      )
    }

    game.round++
    game.doors = [0, 1, 2].sort(() => Math.random() - 0.5)
    return m.reply(
      `${isTreasure ? `${prize.icon} وجدت ${prize.name}! +${gained} نقطة` : '🕸️ الباب كان فارغًا!'}\n\n` +
      `📊 النقاط: *${game.score}*\n` +
      `🎯 الجولة: *${game.round}/5*\n\n` +
      `${board(game)}\n\n` +
      `اختر بابًا: *${usedPrefix}اختار 1* أو 2 أو 3`
    )
  }

  return m.reply(`الأمر غير معروف. اكتب *${usedPrefix}كنز* لبدء اللعبة.`)
}

handler.help = ['كنز', 'اختار 1', 'انسحب']
handler.tags = ['games']
handler.command = /^(كنز|صيد_الكنز|treasure|اختار|اختيار|باب|choose|انسحب|انهاء|خروج|treasurequit)$/i

export default handler