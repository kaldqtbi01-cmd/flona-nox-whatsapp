import axios from 'axios';
import * as cheerio from 'cheerio';

const COOKPAD_ORIGIN = 'https://cookpad.com';
const REQUEST_TIMEOUT_MS = 12_000;

function safeCookpadUrl(href) {
  try {
    const url = new URL(href, COOKPAD_ORIGIN);
    return url.protocol === 'https:' && url.hostname === 'cookpad.com' ? url.href : null;
  } catch {
    return null;
  }
}

async function getPage(url) {
  const response = await axios.get(url, {
    timeout: REQUEST_TIMEOUT_MS,
    maxContentLength: 3 * 1024 * 1024,
    headers: { 'user-agent': 'Mozilla/5.0 (compatible; FlonaBot/1.0)' }
  });
  return cheerio.load(response.data);
}

const handler = async (m, { text, usedPrefix, command, conn }) => {
  const query = typeof text === 'string' ? text.trim() : '';
  if (!query) {
    return m.reply(
      `🍳 *ابحث عن وصفة باللغة الإنجليزية*\nمثال: ${usedPrefix + command} Pancakes`
    );
  }
  if (query.length > 100) return m.reply('⚠️ اجعل عبارة البحث 100 حرف أو أقل.');
  if (/[ء-ي]/.test(query)) {
    return m.reply('⚠️ البحث في هذا المصدر متاح باللغة الإنجليزية حاليًا. مثال: Pizza');
  }

  try {
    const searchUrl = `${COOKPAD_ORIGIN}/id/cari/${encodeURIComponent(query)}`;
    const $search = await getPage(searchUrl);
    const href = $search('a.block-link__main').map((_, element) => $search(element).attr('href')).get().find(Boolean);
    if (!href) return m.reply('لم أجد وصفة مناسبة. جرّب اسم طبق آخر باللغة الإنجليزية.');

    const recipeUrl = safeCookpadUrl(href);
    if (!recipeUrl) return m.reply('❌ رابط نتيجة الوصفة غير صالح.');

    const $ = await getPage(recipeUrl);
    const title = $('h1').first().text().trim();
    const imagePath = $('img[alt^="Foto resep"]').first().attr('src');
    const imageUrl = imagePath ? safeCookpadUrl(imagePath) : null;
    const details = $('.flex.flex-wrap .mise-icon-text').map((_, element) => $(element).text().trim()).get();

    const ingredients = [];
    $('#ingredients .ingredient-list ol li').each((_, element) => {
      const item = $(element);
      if (item.hasClass('font-semibold')) {
        const heading = item.find('span').text().trim();
        if (heading) ingredients.push(`*${heading}*`);
      } else {
        const quantity = item.find('bdi').text().trim();
        const name = item.find('span').text().trim();
        if (name) ingredients.push(`• ${[quantity, name].filter(Boolean).join(' ')}`);
      }
    });

    const steps = [];
    $('ol.list-none li.step').each((_, element) => {
      const item = $(element);
      const step = item.find('div[dir="auto"] p').text().trim();
      if (step) steps.push(`${steps.length + 1}. ${step}`);
    });

    if (!title || (!ingredients.length && !steps.length)) {
      return m.reply('تعذر استخراج تفاصيل الوصفة من المصدر؛ جرّب وصفة أخرى لاحقًا.');
    }

    const caption = `🍽️ *${title}*\n\n⏱️ *الوقت:* ${details[0] || 'غير مذكور'}\n🍴 *الحصص:* ${details.at(-1) || 'غير مذكور'}\n\n📝 *المكونات:*\n${ingredients.join('\n') || 'غير مذكورة'}\n\n👨‍🍳 *الخطوات:*\n${steps.join('\n') || 'غير مذكورة'}\n\nالمصدر: Cookpad`;
    if (imageUrl) {
      await conn.sendMessage(m.chat, { image: { url: imageUrl }, caption }, { quoted: m });
    } else {
      await m.reply(caption);
    }
  } catch (error) {
    console.error('[وصفة]', error);
    await m.reply('❌ تعذر جلب الوصفة حاليًا؛ حاول مجددًا لاحقًا.');
  }
};

handler.help = ['وصفة <اسم الطبق بالإنجليزية>'];
handler.tags = ['tools'];
handler.command = /^(وصفة|وصفه|طبخ)$/i;

export default handler;
