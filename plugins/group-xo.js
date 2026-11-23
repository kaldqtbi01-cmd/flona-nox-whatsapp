import TicTacToe from '../lib/tictactoe.js'

const games = new Map()
const GAME_IDLE_MS = 10 * 60 * 1000
const DIGITS = Object.freeze(['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'])

function normalizeJid(conn, jid) {
  if (typeof jid !== 'string' || !jid) return ''
  try { return conn.decodeJid?.(jid) || jid } catch { return jid }
}

function participantIds(conn, participant) {
  return [participant?.id, participant?.jid, participant?.phoneNumber, participant?.lid]
    .map(jid => normalizeJid(conn, jid))
    .filter(Boolean)
}

function renderBoard(engine) {
  return engine.render().map(cell => cell === 'X' ? '❌' : cell === 'O' ? '⭕' : DIGITS[cell - 1])
    .reduce((rows, cell, index) => {
      const row = Math.floor(index / 3)
      rows[row] = rows[row] ? `${rows[row]} ${cell}` : cell
      return rows
    }, []).join('\n')
}

function sessionKey(conn, chat) {
  return `${conn.user?.jid || conn.user?.id || 'bot'}:${chat}`
}

function clearGame(key, game = games.get(key)) {
  if (game?.timer) clearTimeout(game.timer)
  games.delete(key)
}

function scheduleExpiry(key, game, conn, chat) {
  if (game.timer) clearTimeout(game.timer)
  game.timer = setTimeout(() => {
    if (games.get(key) !== game) return
    games.delete(key)
    Promise.resolve(conn.sendMessage(chat, { text: '⌛ انتهت الجولة بسبب عدم النشاط.' }))
      .catch(error => console.error('[GROUP XO EXPIRY]', error?.message || error))
  }, GAME_IDLE_MS)
  game.timer.unref?.()
}

function send(conn, m, text, mentions = []) {
  return conn.sendMessage(m.chat, { text, mentions }, { quoted: m })
}

const handler = async (m, { conn, text = '', groupMetadata }) => {
  const key = sessionKey(conn, m.chat)
  const sender = normalizeJid(conn, m.sender)
  const input = text.trim().toLocaleLowerCase()
  let game = games.get(key)

  if (game && Date.now() - game.updatedAt > GAME_IDLE_MS) {
    clearGame(key, game)
    game = null
  }

  if (game) {
    if (!game.players.includes(sender)) {
      return m.reply('توجد لعبة قائمة في هذه المجموعة؛ انتظر حتى تنتهي قبل بدء لعبة أخرى.')
    }

    if (/^(انسحاب|انسحب|الغاء|إلغاء|إلغاء_اللعبة)$/i.test(input)) {
      clearGame(key, game)
      return send(conn, m, `🏳️ انتهت اللعبة بالانسحاب.\n${renderBoard(game.engine)}`, game.players)
    }

    const digits = input.replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    if (!/^[1-9]$/.test(digits)) return m.reply('اكتب رقم الخانة من 1 إلى 9، أو .اكس انسحاب لإنهاء اللعبة.')
    if (game.engine.currentTurn !== sender) return m.reply('انتظر دورك؛ اللاعبان يتناوبان بعد كل حركة.')

    const playerIndex = sender === game.x ? 0 : 1
    const result = game.engine.turn(playerIndex, Number(digits) - 1)
    if (result === 0) return m.reply('هذه الخانة مشغولة؛ اختر خانة أخرى من 1 إلى 9.')
    if (result < 0) return m.reply('تعذرت هذه الحركة؛ اختر خانة من 1 إلى 9.')

    game.updatedAt = Date.now()
    scheduleExpiry(key, game, conn, m.chat)
    const board = renderBoard(game.engine)
    if (game.engine.winner) {
      clearGame(key, game)
      const winner = game.engine.winner
      return send(conn, m, `🎉 فاز @${winner.split('@')[0]}!\n\n${board}`, game.players)
    }
    if (game.engine.turns === 9) {
      clearGame(key, game)
      return send(conn, m, `🤝 تعادل!\n\n${board}`, game.players)
    }

    const next = game.engine.currentTurn
    return send(conn, m, `الحركة سُجلت.\n\n${board}\n\nالدور على @${next.split('@')[0]}`, game.players)
  }

  const botIds = new Set([
    conn.user?.id, conn.user?.jid, conn.user?.lid,
    global.botLid ? `${global.botLid}@lid` : '',
  ].map(jid => normalizeJid(conn, jid)).filter(Boolean))
  const senderIds = new Set([sender, ...botIds])
  const target = (m.mentionedJid || [])
    .map(jid => normalizeJid(conn, jid))
    .find(jid => jid && !senderIds.has(jid) && !jid.endsWith('@g.us'))

  if (!target) return m.reply('لبدء اللعبة، أرسل .اكس مع منشن لاعب آخر. بعد ذلك استخدم .اكس 1 إلى .اكس 9 للحركة.')

  const participants = groupMetadata?.participants || []
  if (participants.length) {
    const memberIds = new Set(participants.flatMap(participant => participantIds(conn, participant)))
    if (!memberIds.has(sender) || !memberIds.has(target)) {
      return m.reply('يجب أن يكون اللاعبان عضوين في هذه المجموعة لبدء اللعبة.')
    }
  }

  const engine = new TicTacToe(sender, target)
  game = { engine, x: sender, o: target, players: [sender, target], updatedAt: Date.now() }
  games.set(key, game)
  scheduleExpiry(key, game, conn, m.chat)
  return send(conn, m, `🎮 بدأت لعبة إكس-أو!\n❌ X: @${sender.split('@')[0]}\n⭕ O: @${target.split('@')[0]}\n\n${renderBoard(engine)}\n\nيبدأ X. استخدم .اكس 1 إلى .اكس 9.`, game.players)
}

handler.help = ['اكس @منشن (بدء لعبة جماعية)', 'اكس <1-9> (حركة)', 'اكس انسحاب']
handler.tags = ['games']
handler.command = /^(اكس|إكس_أو_جماعي)$/i
handler.group = true

export default handler
