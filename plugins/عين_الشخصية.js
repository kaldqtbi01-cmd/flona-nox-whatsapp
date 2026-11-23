const TIMEOUT_MS = 60_000;
const REWARD_POINTS = 500;
const SIMILARITY_THRESHOLD = 0.72;
const GAME_DATA_URL = 'https://github.com/anasmods/Nandimonai/raw/main/game/eye.json';

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
  if (a.length === 0 || b.length === 0) return 0;
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let diagonal = previous[0];
    previous[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const above = previous[j];
      previous[j] = Math.min(
        previous[j] + 1,
        previous[j - 1] + 1,
        diagonal + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      diagonal = above;
    }
  }
  return 1 - previous[b.length] / Math.max(a.length, b.length);
}

const handler = async (m, { conn, command }) => {
  conn.tebakAin = conn.tebakAin || {};
  const id = m.chat;

  if (conn.tebakAin[id]) {
    return conn.reply(m.chat, '❐┃لم يتم الإجابة على السؤال بعد┃❌', conn.tebakAin[id].msg);
  }

  try {
    const response = await fetch(GAME_DATA_URL, { signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw new Error(`تعذر تحميل بيانات اللعبة (${response.status})`);
    const source = await response.json();
    if (!Array.isArray(source) || source.length === 0) throw new Error('بيانات اللعبة غير متاحة');

    const candidates = source.filter(item => item?.img && item?.name);
    if (candidates.length === 0) throw new Error('لا توجد أسئلة صالحة');
    const json = candidates[Math.floor(Math.random() * candidates.length)];
    const caption = `*${String(command || 'عين_الشخصية').toUpperCase()}*\n❐↞┇الـوقـت⏳↞ 60 ثانية ┇\n*استخدم «انسحب» للانسحاب*\n❐↞┇الـجـائـزة💰↞ ${REWARD_POINTS} نقطة┇\n➥ 𝗬𝗮𝘁𝗼 𝗕𝗼𝘁`;
    const msg = await conn.sendMessage(m.chat, { image: { url: json.img }, caption }, { quoted: m });

    const timer = setTimeout(async () => {
      const game = conn.tebakAin?.[id];
      if (!game) return;
      try {
        await conn.reply(m.chat, `❮ ⌛ انتهى الوقت ⌛❯\n❐↞┇الإجابة✅↞ ${json.name}┇`, game.msg);
      } catch (error) {
        console.error('[عين الشخصية] تعذر إرسال انتهاء الوقت:', error);
      } finally {
        delete conn.tebakAin[id];
      }
    }, TIMEOUT_MS);

    conn.tebakAin[id] = { msg, json, poin: REWARD_POINTS, timeout: timer };
  } catch (error) {
    console.error('[عين الشخصية]', error);
    await m.reply(`❌ تعذر بدء اللعبة: ${error.message}`);
  }
};

handler.before = async function (m) {
  const conn = this;
  const game = conn.tebakAin?.[m.chat];
  if (!game || typeof m.text !== 'string' || !m.text.trim()) return false;
  if (m.quoted?.id !== game.msg?.key?.id) return false;

  const answer = normalizeAnswer(m.text);
  if (/^(انسحب|surr?ender)$/i.test(answer)) {
    clearTimeout(game.timeout);
    delete conn.tebakAin[m.chat];
    await conn.reply(m.chat, '*استسلمت! كانت الإجابة: ' + game.json.name + '*', m);
    return true;
  }

  const correct = normalizeAnswer(game.json.name);
  if (answer === correct) {
    const user = global.db?.data?.users?.[m.sender];
    if (user) user.exp = (user.exp || 0) + game.poin;
    clearTimeout(game.timeout);
    delete conn.tebakAin[m.chat];
    await conn.reply(m.chat, `*❐┃إجابة صحيحة┃✅*\n\n*❐↞┇الجائزة💰↞ ${game.poin} نقطة*`, m);
  } else if (similarityRatio(answer, correct) >= SIMILARITY_THRESHOLD) {
    await m.reply('*إجابتك قريبة جدًا من الصحيح!*');
  } else {
    await conn.reply(m.chat, '❐┃إجابة خاطئة┃❌', m);
  }
  return true;
};

handler.help = ['عين_الشخصية'];
handler.tags = ['games'];
handler.command = /^(عين_الشخصية|خمن_الشخصية|guesscharacter)$/i;

export default handler;
