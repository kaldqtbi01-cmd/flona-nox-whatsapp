const handler = async (m, { conn, text, usedPrefix }) => {
  const q = m.quoted || m;
  const mime = String((q.msg || q).mimetype || '');
  if (!mime.startsWith('image/')) return m.reply(`🖼️ ردّ على لقطة أنمي بصورة واكتب ${usedPrefix}تعرف_الانمي، أو أرسل صورة معها الأمر.`);
  try {
    const buffer = await q.download();
    if (!buffer?.length || buffer.length > 10 * 1024 * 1024) throw new Error('الصورة غير متاحة أو أكبر من 10 ميغابايت.');
    await conn.sendMessage(m.chat, { react: { text: '🔎', key: m.key } }).catch(() => {});
    const form = new FormData();
    form.append('image', new Blob([buffer], { type: mime.split(';')[0] }), 'scene.jpg');
    const response = await fetch('https://api.trace.moe/search?anilistInfo', { method: 'POST', body: form, signal: AbortSignal.timeout(30_000) });
    if (!response.ok) throw new Error(`خدمة البحث أعادت الحالة ${response.status}`);
    const data = await response.json();
    const matches = (data.result || []).slice(0, 5);
    if (!matches.length) return m.reply('لم أجد تطابقًا واضحًا. جرّب لقطة أوضح ومن دون نصوص تغطي الصورة.');
    const lines = matches.map((r, i) => {
      const title = r.anilist?.title?.english || r.anilist?.title?.romaji || r.anilist?.title?.native || 'عنوان غير متاح';
      const percent = Math.round((r.similarity || 0) * 100);
      const second = Math.floor(r.from || 0);
      const link = r.anilist?.id ? `https://anilist.co/anime/${r.anilist.id}` : '';
      return `${i + 1}. *${title}* — تطابق ${percent}%\nالحلقة: ${r.episode ?? '؟'} | الوقت: ${Math.floor(second / 60)}:${String(second % 60).padStart(2, '0')}${link ? `\n${link}` : ''}`;
    });
    await conn.sendMessage(m.chat, { text: `🎌 *نتائج التعرّف على لقطة الأنمي*\n\n${lines.join('\n\n')}` }, { quoted: m });
  } catch (error) {
    console.error('[تعرف الأنمي]', error?.message || error);
    return m.reply('تعذر تحليل الصورة الآن. تأكد من اتصال البوت بالإنترنت ثم جرّب لاحقًا.');
  }
};
handler.help = ['تعرف_الانمي (رد على صورة)'];
handler.tags = ['anime'];
handler.command = /^(تعرف_الانمي|tracemoe|whatanime|trace)$/i;
export default handler;
