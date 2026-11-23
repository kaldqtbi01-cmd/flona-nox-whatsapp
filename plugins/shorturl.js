// plugins/shorturl.js
// YATO BOT MD - اختصار الروابط

import https from 'node:https';
import crypto from 'node:crypto';

function shortenUrl(inputUrl) {
  return new Promise((resolve, reject) => {
    const boundary = `----geckoformboundary${crypto.randomBytes(16).toString('hex')}`;
    const body = `--${boundary}\r\nContent-Disposition: form-data; name="url"\r\n\r\n${inputUrl}\r\n--${boundary}--\r\n`;
    const options = {
      hostname: 'kua.lat',
      path: '/shorten',
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': Buffer.byteLength(body),
        'x-requested-with': 'XMLHttpRequest',
        accept: 'application/json, text/javascript, */*; q=0.01',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:153.0) Gecko/20100101 Firefox/153.0',
        origin: 'https://kua.lat',
        referer: 'https://kua.lat/'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          resolve(null);
          return;
        }
        try {
          const parsed = JSON.parse(data);
          resolve(parsed?.data?.shorturl || null);
        } catch {
          resolve(null);
        }
      });
    });

    req.setTimeout(15000, () => req.destroy(new Error('Short URL service timed out')));
    req.on('error', reject);
    req.end(body);
  });
}

const handler = async (m, { conn, text, usedPrefix, command }) => {
  const url = text?.trim() || m.quoted?.text?.trim() || '';

  if (!url) {
    return m.reply(`🔗 *يرجى إدخال الرابط المراد اختصاره!*\n\n💡 *مثال:* \`${usedPrefix + command} https://www.youtube.com\``);
  }

  if (!/^https?:\/\//i.test(url)) {
    return m.reply('❌ *يرجى إدخال رابط صحيح يبدأ بـ http:// أو https://*');
  }

  await conn.sendPresenceUpdate('composing', m.chat);

  try {
    const shortResult = await shortenUrl(url);
    if (!shortResult) {
      return m.reply('❌ فشل اختصار الرابط، تأكد من صحة الرابط وحاول مجدداً.');
    }

    await m.reply(`🔗 *تم اختصار الرابط بنجاح!*\n\n📥 *الرابط الأصلي:*\n${url}\n\n✂️ *الرابط المختصر:*\n${shortResult}`);
  } catch (error) {
    console.error('Shorten URL Error:', error);
    await m.reply('❌ حدث خطأ أثناء الاتصال بخدمة اختصار الروابط.');
  }
};

handler.help = ['اختصار <الرابط>'];
handler.tags = ['tools'];
handler.command = /^(اختصار|اختصار_رابط|short|shorturl)$/i;

export default handler;
