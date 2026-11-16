import axios from 'axios'
import { FOOTBALL_PLAYERS, TOP_FIVE_LEAGUE_IDS } from '../data/football-players.js'

const COMMONS_API = 'https://commons.wikimedia.org/w/api.php'
let commonsQueue = Promise.resolve()
let nextCommonsRequestAt = 0

async function requestCommons(url, config, httpGet) {
  const previous = commonsQueue
  let release
  commonsQueue = new Promise(resolve => { release = resolve })
  await previous
  try {
    const wait = Math.max(0, nextCommonsRequestAt - Date.now())
    if (wait) await new Promise(resolve => setTimeout(resolve, wait))
    try {
      return await httpGet(url, config)
    } finally {
      nextCommonsRequestAt = Date.now() + 1_100
    }
  } finally {
    release()
  }
}

export function normalizeFootballText(value) {
  return String(value || '').toLocaleLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f\u064b-\u065f\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ')
}

function containsPhrase(text, phrase) {
  const normalized = normalizeFootballText(phrase)
  return Boolean(normalized && ` ${text} `.includes(` ${normalized} `))
}

function leagueDefinitions() {
  return [
    { id: 'premier_league', terms: ['الدوري الانجليزي', 'الدوري الانجليزي الممتاز', 'البريميرليغ', 'البريميرليج', 'premier league'] },
    { id: 'la_liga', terms: ['الدوري الاسباني', 'لا ليغا', 'لاليغا', 'la liga'] },
    { id: 'serie_a', terms: ['الدوري الايطالي', 'سيري ا', 'serie a'] },
    { id: 'bundesliga', terms: ['الدوري الالماني', 'بوندسليغا', 'bundesliga'] },
    { id: 'ligue_1', terms: ['الدوري الفرنسي', 'ليغ 1', 'ligue 1'] },
    { id: 'saudi_pro', terms: ['الدوري السعودي', 'الدوري السعودي للمحترفين', 'saudi pro league'] },
    { id: 'mls', terms: ['الدوري الامريكي', 'الدوري الامريكي لكرة القدم', 'mls'] },
    { id: 'primeira_liga', terms: ['الدوري البرتغالي', 'الدوري البرتغالي الممتاز', 'primeira liga'] },
    { id: 'eredivisie', terms: ['الدوري الهولندي', 'الدوري الهولندي الممتاز', 'eredivisie'] },
  ]
}

const TOP_FIVE_TERMS = ['الدوريات الخمس الكبرى', 'الدوريات الخمسه الكبري', 'الخمس الكبرى', 'الخمسة الكبرى', 'big five', 'top five']
const POSITION_TERMS = [
  { id: 'goalkeeper', terms: ['حارس مرمى', 'حارس', 'goalkeeper', 'goal keeper'] },
  { id: 'defense', terms: ['مدافع', 'دفاع', 'defender', 'defence', 'defense'] },
  { id: 'midfield', terms: ['لاعب وسط', 'وسط', 'midfielder', 'midfield'] },
  { id: 'attack', terms: ['مهاجم', 'هجوم', 'جناح', 'راس حربه', 'forward', 'striker', 'attacker'] },
]

function includesAny(text, terms) {
  return terms.some(term => containsPhrase(text, term))
}

function clubMatch(query, players, target) {
  const knownClubs = players.flatMap(player => [
    { term: player.clubAr, key: player.clubEn },
    { term: player.clubEn, key: player.clubEn },
    ...(player.clubAliases || []).map(term => ({ term, key: player.clubEn })),
  ]).filter(item => item.term)
    .sort((a, b) => normalizeFootballText(b.term).length - normalizeFootballText(a.term).length)
  const matched = knownClubs.find(item => containsPhrase(query, item.term))
  return matched ? matched.key === target.clubEn : null
}

function nationalityMatch(query, target) {
  const terms = [target.nationalityAr, ...(target.nationalityAliases || []), ...(target.nationalityEn || [])]
  return includesAny(query, terms)
}

export function answerFootballQuestion(question, target, players = FOOTBALL_PLAYERS) {
  const query = normalizeFootballText(question)
  if (!query) return { supported: false }

  if (includesAny(query, TOP_FIVE_TERMS)) {
    return { supported: true, yes: TOP_FIVE_LEAGUE_IDS.has(target.leagueId), kind: 'top-five' }
  }

  const league = leagueDefinitions().find(item => includesAny(query, item.terms))
  if (league) return { supported: true, yes: target.leagueId === league.id, kind: 'league' }

  const clubAnswer = clubMatch(query, players, target)
  if (clubAnswer !== null) return { supported: true, yes: clubAnswer, kind: 'club' }

  const nationalityTerms = players.flatMap(player => [
    player.nationalityAr,
    ...(player.nationalityAliases || []),
    ...(player.nationalityEn || []),
  ]).filter(Boolean).sort((a, b) => normalizeFootballText(b).length - normalizeFootballText(a).length)
  const nationality = nationalityTerms.find(term => containsPhrase(query, term))
  if (nationality) return { supported: true, yes: nationalityMatch(query, target), kind: 'nationality' }

  const position = POSITION_TERMS.find(item => includesAny(query, item.terms))
  if (position) return { supported: true, yes: target.position === position.id, kind: 'position' }

  return { supported: false }
}

export function isFootballPlayerGuessCorrect(guess, player) {
  const normalizedGuess = normalizeFootballText(String(guess || '').replace(/^اللاعب\s+/i, ''))
  if (!normalizedGuess) return false
  const accepted = [player.nameAr, player.nameEn, player.id, ...(player.aliasesAr || [])]
  return accepted.some(name => normalizeFootballText(name) === normalizedGuess)
}

function stripHtml(value) {
  return String(value || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&#0*39;/g, "'").trim()
}

function hasUsableImageLicense(value) {
  const license = stripHtml(value)
  return /^(?:CC0|CC BY(?:-SA)?(?:\s|$)|Public domain)/i.test(license) && !/(?:-NC|-ND)\b/i.test(license)
}

function randomIndex(random, length) {
  const value = Number(random())
  if (!Number.isFinite(value)) return 0
  return Math.max(0, Math.min(length - 1, Math.floor(value * length)))
}

function chooseTwoPlayers(players, random) {
  if (!Array.isArray(players) || players.length < 2) throw new Error('قاعدة اللاعبين تحتاج لاعبين اثنين على الأقل.')
  const firstIndex = randomIndex(random, players.length)
  const candidates = players.filter((_, index) => index !== firstIndex)
  const secondIndex = randomIndex(random, candidates.length)
  return [players[firstIndex], candidates[secondIndex]]
}

export async function findFreePlayerPhoto(player, httpGet = (url, config) => axios.get(url, config)) {
  const endpoint = new URL(COMMONS_API)
  endpoint.search = new URLSearchParams({
    action: 'query',
    generator: 'search',
    gsrsearch: `${player.nameEn} football`,
    gsrnamespace: '6',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '640',
    gsrlimit: '15',
    format: 'json',
  }).toString()
  let response
  try {
    response = await requestCommons(endpoint.toString(), {
    timeout: 20_000,
    maxContentLength: 2 * 1024 * 1024,
      headers: { 'User-Agent': 'FlonaFootballGuess/1.0 (https://github.com/kaldqtbi01-cmd/flona-nox-whatsapp)', Accept: 'application/json' },
    }, httpGet)
  } catch (error) {
    if (error?.response?.status === 429) {
      throw new Error('مصدر الصور يطلب مهلة مؤقتة. انتظر قليلًا ثم أعد بدء الجولة.')
    }
    throw new Error(`تعذر الاتصال بمصدر صور Wikimedia Commons: ${error?.message || 'خطأ شبكة'}`)
  }
  const pages = Object.values(response?.data?.query?.pages || {})
  const nameTokens = normalizeFootballText(player.nameEn).split(' ').filter(token => token.length > 2)
  const suitable = pages.map(page => {
    const info = page.imageinfo?.[0]
    const metadata = info?.extmetadata || {}
    const haystack = normalizeFootballText(`${page.title || ''} ${stripHtml(metadata.ImageDescription?.value)}`)
    const matches = nameTokens.filter(token => containsPhrase(haystack, token)).length
    return { page, info, metadata, matches }
  }).filter(item => {
    if (!item.info?.thumburl || item.matches < Math.min(2, nameTokens.length)) return false
    return hasUsableImageLicense(item.metadata.LicenseShortName?.value)
  }).sort((a, b) => b.matches - a.matches)

  const selected = suitable[0]
  if (!selected) throw new Error('لم أجد صورة موثقة بترخيص مناسب لإحدى بطاقات اللعبة. لم تبدأ الجولة.')
  const imageUrl = new URL(selected.info.thumburl)
  if (imageUrl.protocol !== 'https:' || !(imageUrl.hostname === 'wikimedia.org' || imageUrl.hostname.endsWith('.wikimedia.org'))) {
    throw new Error('رابط صورة اللاعب غير آمن؛ ألغيت الجولة.')
  }
  const license = stripHtml(selected.metadata.LicenseShortName?.value)
  const artist = stripHtml(selected.metadata.Artist?.value || selected.metadata.Credit?.value || 'مساهم Wikimedia Commons')
  let licenseUrl = ''
  try {
    const parsedLicenseUrl = new URL(stripHtml(selected.metadata.LicenseUrl?.value))
    if (['http:', 'https:'].includes(parsedLicenseUrl.protocol) && (parsedLicenseUrl.hostname === 'creativecommons.org' || parsedLicenseUrl.hostname.endsWith('.creativecommons.org'))) {
      licenseUrl = parsedLicenseUrl.toString()
    }
  } catch {}
  return {
    url: imageUrl.toString(),
    credit: `${artist} — ${license}`,
    sourceUrl: 'https://commons.wikimedia.org/',
    licenseUrl,
  }
}

function otherPlayer(game, jid) {
  return game.players.find(player => player !== jid)
}

function turnCaption(game, prefix) {
  const card = game.cards[game.turn]
  return `⚽ *تحدّي تخمين لاعب كرة القدم*\nالدور الآن على @${game.turn.split('@')[0]}\n\nمن اللاعب في الصورة؟ اسأل سؤالًا إجابته نعم أو لا:\n${prefix}لاعب_سؤال هل يلعب في الدوري الإنجليزي؟\nأو خمّن مباشرة:\n${prefix}لاعب_خمن <اسم اللاعب>\n\n${card.credit} — Wikimedia Commons\n${card.licenseUrl || card.sourceUrl}`
}

async function showTurnImage(conn, game, prefix) {
  await conn.sendMessage(game.chat, {
    image: { url: game.cards[game.turn].url },
    caption: turnCaption(game, prefix),
    mentions: [game.turn],
  })
}

function normalizeJid(jid) {
  return String(jid || '').replace(/:[0-9]+@/, '@')
}

export function createFootballGuessHandler({
  players = FOOTBALL_PLAYERS,
  random = Math.random,
  httpGet = (url, config) => axios.get(url, config),
  imageLookup = player => findFreePlayerPhoto(player, httpGet),
} = {}) {
  const games = new Map()
  const photoCache = new Map()
  const getPhoto = async player => {
    if (!photoCache.has(player.id)) photoCache.set(player.id, await imageLookup(player))
    return photoCache.get(player.id)
  }

  const handler = async (m, { conn, text = '', args = [], command = '', usedPrefix = '.', participants = [] }) => {
    const action = String(command || '').toLowerCase()
    const prefix = usedPrefix || '.'
    const query = String(text || args.join(' ') || '').trim()
    const chat = m.chat
    const game = games.get(chat)

    if (action === 'تخمين_لاعب') {
      if (!m.isGroup) return m.reply('❌ ابدأ تحدي اللاعبين داخل مجموعة واتساب.')
      if (game) return m.reply('⚠️ توجد جولة لاعبين قائمة. أنهِها أولًا بالأمر .لاعب_انهاء.')
      const opponent = m.mentionedJid?.[0] || m.quoted?.sender
      if (!opponent || normalizeJid(opponent) === normalizeJid(m.sender)) {
        return m.reply(`اذكر مشاركًا واحدًا فقط لبدء اللعبة.\nمثال: ${prefix}تخمين_لاعب @الشخص`)
      }
      if (normalizeJid(opponent) === normalizeJid(conn.user?.jid)) return m.reply('❌ لا يمكن اختيار البوت كمشارك.')
      if (participants.length && !participants.some(item => normalizeJid(item.id || item.jid) === normalizeJid(opponent))) {
        return m.reply('❌ يجب أن يكون المشارك الآخر عضوًا في المجموعة.')
      }

      try {
        const [firstCard, secondCard] = chooseTwoPlayers(players, random)
        const [firstPhoto, secondPhoto] = await Promise.all([getPhoto(firstCard), getPhoto(secondCard)])
        const gameState = {
          chat,
          host: m.sender,
          players: [m.sender, opponent],
          playerDetails: { [m.sender]: firstCard, [opponent]: secondCard },
          cards: { [m.sender]: firstPhoto, [opponent]: secondPhoto },
          turn: m.sender,
          phase: 'playing',
          winner: null,
          loser: null,
          verdict: null,
        }
        games.set(chat, gameState)
        try {
          await showTurnImage(conn, gameState, prefix)
        } catch (error) {
          games.delete(chat)
          throw error
        }
        return 1
      } catch (error) {
        return m.reply(`❌ تعذر بدء اللعبة: ${error?.message || 'حدث خطأ أثناء تجهيز الصورة.'}`)
      }
    }

    if (!game) return m.reply(`لا توجد جولة لاعبين في هذه المجموعة. اكتب ${prefix}تخمين_لاعب مع ذكر لاعب واحد.`)
    if (!game.players.includes(m.sender)) return m.reply('❌ هذه اللعبة للمشاركين الاثنين المسجلين فقط.')

    if (action === 'لاعب_انهاء') {
      if (m.sender !== game.host) return m.reply('❌ صاحب الجولة فقط يستطيع إنهاءها.')
      games.delete(chat)
      return m.reply('🛑 تم إنهاء جولة تخمين اللاعبين.')
    }

    if (action === 'لاعب_حالة') {
      if (game.phase === 'playing') return m.reply(`🎯 الدور على @${game.turn.split('@')[0]}.`)
      return m.reply(`🏁 فاز @${game.winner.split('@')[0]}. ${game.verdict ? `الحكم: ${game.verdict}` : 'بانتظار الحكم على الخاسر.'}`)
    }

    if (action === 'لاعب_حكم') {
      if (game.phase !== 'verdict') return m.reply('يُكتب الحكم بعد فوز أحد المشاركين.')
      if (m.sender !== game.winner) return m.reply('الحكم يكتبه الفائز فقط.')
      if (!query) return m.reply(`اكتب الحكم بعد الأمر. مثال: ${prefix}لاعب_حكم غنِّ مقطعًا من أغنية.`)
      game.verdict = query.slice(0, 300)
      const message = `📜 *الحكم على الخاسر*\nالفائز: @${game.winner.split('@')[0]}\nالخاسر: @${game.loser.split('@')[0]}\n\n${game.verdict}`
      games.delete(chat)
      return m.reply(message)
    }

    if (game.phase !== 'playing') return m.reply(`انتهت الجولة. اكتب ${prefix}لاعب_حكم لإضافة الحكم أو ${prefix}لاعب_انهاء.`)
    if (m.sender !== game.turn) return m.reply(`⏳ انتظر دورك. الدور الآن على @${game.turn.split('@')[0]}.`)

    if (action === 'لاعب_سؤال') {
      if (!query) return m.reply(`اكتب سؤالًا بعد الأمر. مثال: ${prefix}لاعب_سؤال هل يلعب في الدوري الإنجليزي؟`)
      const answer = answerFootballQuestion(query, game.playerDetails[m.sender], players)
      if (!answer.supported) {
        return m.reply(`❔ لا أستطيع تحديد هذا السؤال. اسأل عن الانتماء للدوريات الخمس الكبرى، أو دوري محدد، أو النادي، أو الجنسية، أو المركز.`)
      }
      if (answer.yes) {
        return m.reply(`✅ *نعم.* بقي الدور لك؛ اسأل سؤالًا آخر أو خمّن اسم اللاعب بـ ${prefix}لاعب_خمن <الاسم>.`)
      }
      game.turn = otherPlayer(game, m.sender)
      await m.reply(`❌ *لا.* انتقل الدور إلى @${game.turn.split('@')[0]}.`)
      await showTurnImage(conn, game, prefix)
      return 1
    }

    if (action === 'لاعب_خمن') {
      if (!query) return m.reply(`اكتب اسم اللاعب بعد الأمر. مثال: ${prefix}لاعب_خمن كريستيانو رونالدو`)
      const target = game.playerDetails[m.sender]
      if (isFootballPlayerGuessCorrect(query, target)) {
        game.phase = 'verdict'
        game.winner = m.sender
        game.loser = otherPlayer(game, m.sender)
        const otherCard = game.playerDetails[game.loser]
        return m.reply(`🎉 *خمنت اللاعب بنجاح!*\nالفائز: @${game.winner.split('@')[0]}\nالخاسر: @${game.loser.split('@')[0]}\n\nاللاعب كان: *${target.nameAr}*\nواللاعب الآخر كان: *${otherCard.nameAr}*\n\nحان وقت الحكم على الخاسر: ${prefix}لاعب_حكم <الحكم>`)
      }
      game.turn = otherPlayer(game, m.sender)
      await m.reply(`❌ الاسم غير صحيح. انتقل الدور إلى @${game.turn.split('@')[0]}.`)
      await showTurnImage(conn, game, prefix)
      return 0
    }

    return m.reply(`أوامر اللعبة: ${prefix}لاعب_سؤال <سؤال نعم/لا>، ${prefix}لاعب_خمن <الاسم>، ${prefix}لاعب_حالة.`)
  }

  handler.help = [
    'تخمين_لاعب @شخص',
    'لاعب_سؤال <سؤال نعم أو لا>',
    'لاعب_خمن <اسم اللاعب>',
    'لاعب_حكم <حكم على الخاسر>',
    'لاعب_حالة',
    'لاعب_انهاء',
  ]
  handler.tags = ['games']
  handler.command = /^(تخمين_لاعب|لاعب_سؤال|لاعب_خمن|لاعب_حكم|لاعب_حالة|لاعب_انهاء)$/i
  return handler
}

export default createFootballGuessHandler()
