import { isIP } from 'node:net';

const API = 'https://bioskop-six.vercel.app/slideshare';
function validSlideShareUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ['www.slideshare.net', 'slideshare.net'].includes(url.hostname.toLowerCase()) && url.pathname.length > 1;
  } catch { return false; }
}

const handler = async (m, { conn, text, usedPrefix }) => {
  const url = String(text || '').trim().split(/\s+/)[0];
  if (!validSlideShareUrl(url)) return m.reply(`أرسل رابطًا مباشرًا من slideshare.net.\nمثال: ${usedPrefix}عرض_شرائح https://www.slideshare.net/...`);
  try {
    await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } }).catch(() => {});
    const sent = [];
    for (const type of ['pdf', 'pptx']) {
      const endpoint = `${API}?url=${encodeURIComponent(url)}&filetype=${type}`;
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(45_000) });
      if (!response.ok) continue;
      const data = await response.json().catch(() => ({}));
      const download = data.download_url;
      if (!download) continue;
      let parsed;
      try { parsed = new URL(download); } catch { continue; }
      const host = parsed.hostname.toLowerCase();
      const trustedHost = ['slideshare.net', 'slidesharecdn.com', 'slidesharecdn.net'].some(domain => host === domain || host.endsWith(`.${domain}`));
      if (parsed.protocol !== 'https:' || parsed.username || parsed.password || isIP(host) || !trustedHost) continue;
      const filename = `slideshare-${Date.now()}.${type}`;
      await conn.sendMessage(m.chat, {
        document: { url: parsed.href },
        mimetype: type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        fileName: filename,
        caption: `تم تجهيز نسخة ${type.toUpperCase()} من العرض.`
      }, { quoted: m });
      sent.push(type);
    }
    if (!sent.length) return m.reply('لم تُرجع خدمة التنزيل ملفات. قد تكون الخدمة الخارجية متوقفة أو لا يدعم الرابط التنزيل.');
  } catch (error) {
    console.error('[SlideShare]', error?.message || error);
    return m.reply('تعذر التنزيل حاليًا. يعتمد الأمر على خدمة خارجية غير رسمية قد تتوقف أحيانًا.');
  }
};
handler.help = ['عرض_شرائح <رابط SlideShare>'];
handler.tags = ['download'];
handler.command = /^(عرض_شرائح|slideshare|slidedl)$/i;
export default handler;
