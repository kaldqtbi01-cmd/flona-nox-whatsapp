import axios from 'axios';
import crypto from 'node:crypto';

const handler = async (m, { conn, text, command }) => {
  const query = typeof text === 'string' ? text.trim() : '';
  if (!query) return m.reply(`اكتب نوع الفيلم أو اسمه. مثال: .${command} Batman`);
  if (query.length > 120) return m.reply('عبارة البحث طويلة جدًا؛ اجعلها 120 حرفًا أو أقل.');

  try {
    const { data } = await axios.post('https://filmfinder.ai/api/main', {
      query,
      sessionId: crypto.randomBytes(11).toString('hex').slice(0, 21)
    }, {
      timeout: 15_000,
      headers: { 'content-type': 'application/json', accept: 'application/json' }
    });
    if (!Array.isArray(data) || data.length === 0) return m.reply('لم أجد أفلامًا مطابقة لهذا البحث.');
    const results = data.slice(0, 10).map((film, index) =>
      `${index + 1}. *${String(film.title || 'بدون عنوان').slice(0, 160)}* (${film.year || 'السنة غير متاحة'})`
    );
    await conn.sendMessage(m.chat, {
      text: `🎬 *نتائج البحث عن: ${query}*\n\n${results.join('\n')}`
    }, { quoted: m });
  } catch (error) {
    console.error('[بحث الأفلام]', error);
    await m.reply('❌ تعذر البحث عن الأفلام الآن؛ حاول لاحقًا.');
  }
};

handler.help = ['أفلام <اسم أو نوع الفيلم>'];
handler.tags = ['download'];
handler.command = /^(sfilm|افلام|أفلام)$/i;

export default handler;
