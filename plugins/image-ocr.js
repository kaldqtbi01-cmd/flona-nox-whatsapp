const handler = async (m, { conn, usedPrefix }) => {
  const q = m.quoted || m;
  const mime = String((q.msg || q).mimetype || '');
  if (!mime.startsWith('image/')) return m.reply(`ردّ على صورة واكتب ${usedPrefix}استخراج_نص، أو أرسل صورة مع الأمر.`);
  const apiKey = process.env.OCR_SPACE_API_KEY;
  if (!apiKey) return m.reply('ميزة OCR تحتاج مفتاح OCR.Space. أضف OCR_SPACE_API_KEY إلى ملف .env ثم أعد تشغيل البوت.');
  try {
    const buffer = await q.download();
    if (!buffer?.length || buffer.length > 5 * 1024 * 1024) throw new Error('الصورة غير متاحة أو أكبر من 5 ميغابايت.');
    const form = new FormData();
    form.append('apikey', apiKey);
    form.append('language', 'ara');
    form.append('isOverlayRequired', 'false');
    form.append('file', new Blob([buffer], { type: mime.split(';')[0] }), 'image.jpg');
    const response = await fetch('https://api.ocr.space/parse/image', { method: 'POST', body: form, signal: AbortSignal.timeout(45_000) });
    if (!response.ok) throw new Error(`خدمة OCR أعادت الحالة ${response.status}`);
    const data = await response.json();
    if (data.IsErroredOnProcessing) throw new Error(Array.isArray(data.ErrorMessage) ? data.ErrorMessage.join(' ') : 'تعذر التعرف على النص.');
    const text = (data.ParsedResults || []).map(x => x.ParsedText || '').filter(Boolean).join('\n').trim();
    if (!text) return m.reply('لم أجد نصًا واضحًا في الصورة.');
    return conn.sendMessage(m.chat, { text: `📝 *النص المستخرج من الصورة*\n\n${text.slice(0, 6000)}` }, { quoted: m });
  } catch (error) {
    console.error('[OCR]', error?.message || error);
    return m.reply(`تعذر استخراج النص: ${error.message || 'خطأ غير معروف'}`);
  }
};
handler.help = ['استخراج_نص (رد على صورة)'];
handler.tags = ['tools'];
handler.command = /^(استخراج_نص|ocr|scantext)$/i;
export default handler;
