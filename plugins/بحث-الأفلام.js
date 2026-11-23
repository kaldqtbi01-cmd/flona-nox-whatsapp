import crypto from 'node:crypto';

const handler = async (m, { conn, text, command }) => {
  const query = typeof text === 'string' ? text.trim() : '';
  if (!query) return m.reply(`اكتب اسم الفيلم أو نوعه. مثال: .${command} Batman`);
  if (query.length > 120) return m.reply('عبارة البحث طويلة جدًا؛ اجعلها 120 حرفًا أو أقل.');

  try {
    const response = await fetch('https://filmfinder.ai/api/main', {
      method: 'POST',
      signal: AbortSignal.timeout(30_000),
      headers: { 'content-type': 'application/json', accept: 'text/event-stream' },
      body: JSON.stringify({ query, sessionId: crypto.randomBytes(11).toString('hex') })
    });
    if (!response.ok) throw new Error(`FilmFinder HTTP ${response.status}`);
    const body = await response.text();
    const movies = body
      .split(/\r?\n/)
      .filter(line => line.startsWith('data:'))
      .map(line => {
        try { return JSON.parse(line.slice(5).trim()); } catch { return null; }
      })
      .filter(item => item && item.title && item.is_movie !== false);

    const unique = [...new Map(movies.map(movie => [`${movie.title}:${movie.year || ''}`, movie])).values()];
    if (!unique.length) return m.reply('لم أجد أفلامًا مطابقة لهذا البحث. جرّب كتابة الاسم بالإنجليزية.');

    const results = unique.slice(0, 8).map((movie, index) =>
      `${index + 1}. *${String(movie.title).slice(0, 160)}* (${movie.year || 'السنة غير متاحة'})${movie.reason ? `\n   ${String(movie.reason).slice(0, 220)}` : ''}`
    );
    await conn.sendMessage(m.chat, {
      text: `🎬 *نتائج البحث عن: ${query}*\n\n${results.join('\n')}`
    }, { quoted: m });
  } catch (error) {
    console.error('[بحث الأفلام]', error?.cause?.code || error?.message || error);
    await m.reply('❌ تعذر الاتصال بخدمة البحث عن الأفلام الآن؛ حاول لاحقًا.');
  }
};

handler.help = ['أفلام <اسم أو نوع الفيلم>'];
handler.tags = ['download'];
handler.command = /^(sfilm|افلام|أفلام)$/i;

export default handler;
