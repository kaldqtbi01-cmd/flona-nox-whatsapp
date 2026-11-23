const GAME_TIMEOUT_MS = 60_000;
const REWARD_POINTS = 500;
const GAME_DATA_URL = 'https://github.com/anasmods/Nandimonai/raw/main/game/whois.json';
const SIMILARITY_THRESHOLD = 0.72;

function normalizeAnswer(value) {
  return String(value || '')
    .normalize('NFKC')
    .toLocaleLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function similarityRatio(left, right) {
  const a = Array.from(left);
  const b = Array.from(right);
  if (!a.length || !b.length) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
    previous = current;
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

const handler = async (m, { conn, command }) => {
  conn.tebakWhois = conn.tebakWhois || {};
  const chatId = m.chat;
  const activeGame = conn.tebakWhois[chatId];
  if (activeGame) {
    return conn.reply(m.chat, '❐┃لم تتم الإجابة على السؤال بعد┃❌', activeGame.msg);
  }

  try {
    const response = await fetch(GAME_DATA_URL, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`تعذر تحميل بيانات اللعبة (${response.status})`);
    const source = await response.json();
    if (!Array.isArray(source)) throw new Error('بيانات اللعبة غير صالحة');
    const candidates = source.filter(item => item?.img && item?.name);
    if (!candidates.length) throw new Error('لا توجد أسئلة متاحة');

    const character = candidates[Math.floor(Math.random() * candidates.length)];
    const caption = `*${String(command || 'احزر_الشخصية').toUpperCase()}*\n❐↞┇الوقت⏳↞ 60 ثانية\n*استخدم «انسحب» للانسحاب*\n❐↞┇الجائزة💰↞ ${REWARD_POINTS} نقطة\n➥ 𝗬𝗮𝘁𝗼 𝗕𝗼𝘁`;
    const sentMessage = await conn.sendMessage(
      m.chat,
      { image: { url: character.img }, caption },
      { quoted: m }
    );

    const timer = setTimeout(async () => {
      const game = conn.tebakWhois?.[chatId];
      if (!game) return;
      try {
        await conn.reply(m.chat, `❮ ⌛ انتهى الوقت ⌛❯\n❐↞┇الإجابة✅↞ ${character.name}`, game.msg);
      } catch (error) {
        console.error('[احزر الشخصية] تعذر إرسال انتهاء الوقت:', error);
      } finally {
        delete conn.tebakWhois[chatId];
      }
    }, GAME_TIMEOUT_MS);

    conn.tebakWhois[chatId] = {
      msg: sentMessage,
      character,
      reward: REWARD_POINTS,
      timer
    };
  } catch (error) {
    console.error('[احزر الشخصية]', error);
    await m.reply(`❌ تعذر بدء اللعبة: ${error.message}`);
  }
};

handler.before = async function (m) {
  const game = this.tebakWhois?.[m.chat];
  if (!game || typeof m.text !== 'string' || !m.text.trim()) return false;
  if (m.quoted?.id !== game.msg?.key?.id) return false;

  const answer = normalizeAnswer(m.text);
  if (/^(انسحب|surr?ender)$/i.test(answer)) {
    clearTimeout(game.timer);
    delete this.tebakWhois[m.chat];
    await this.reply(m.chat, `*انسحبت من اللعبة! الإجابة كانت: ${game.character.name}*`, m);
    return true;
  }

  const correctAnswer = normalizeAnswer(game.character.name);
  if (answer === correctAnswer) {
    const user = global.db?.data?.users?.[m.sender];
    if (user) user.exp = (user.exp || 0) + game.reward;
    clearTimeout(game.timer);
    delete this.tebakWhois[m.chat];
    await this.reply(m.chat, `*❐┃إجابة صحيحة┃✅*\n\n*الجائزة: ${game.reward} نقطة*`, m);
  } else if (similarityRatio(answer, correctAnswer) >= SIMILARITY_THRESHOLD) {
    await m.reply('*إجابتك قريبة جدًا من الصحيح!*');
  } else {
    await this.reply(m.chat, '❐┃إجابة خاطئة┃❌', m);
  }
  return true;
};

handler.help = ['حزر'];
handler.tags = ['games'];
handler.command = /^(حزر|whois)$/i;

export default handler;
