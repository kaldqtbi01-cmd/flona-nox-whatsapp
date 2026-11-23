import axios from 'axios';

const sentVideos = new Set();

const handler = async (message, { conn, text, usedPrefix = '.' }) => {
  await conn.sendMessage(message.chat, {
    react: { text: '🎥', key: message.key }
  });

  const searchText = typeof text === 'string' ? text.trim() : '';
  if (!searchText) {
    return conn.sendMessage(message.chat, {
      text: `⚠️ *الرجاء إدخال اسم الفيديو أو النص المطلوب للبحث عنه.*\n\nمثال: ${usedPrefix}تصميم سورة المؤمنون`
    });
  }

  const query = `تصميم ${searchText}`;

  try {
    const { data: response } = await axios.get(
      'https://apis-starlights-team.koyeb.app/starlight/tiktoksearch',
      { params: { text: query }, timeout: 20000 }
    );
    const results = Array.isArray(response?.data) ? response.data : [];

    if (results.length === 0) {
      return conn.sendMessage(message.chat, {
        text: `⚠️ لم يتم العثور على نتائج لكلمة البحث: *${query}*`
      });
    }

    const availableResults = results.filter(result =>
      typeof result?.nowm === 'string' && result.nowm && !sentVideos.has(result.nowm)
    );

    if (availableResults.length === 0) {
      return conn.sendMessage(message.chat, {
        text: '⚠️ كل الفيديوهات المتاحة تم إرسالها بالفعل.'
      });
    }

    const result = availableResults[Math.floor(Math.random() * availableResults.length)];
    sentVideos.add(result.nowm);

    if (sentVideos.size > 1000) sentVideos.clear();

    await conn.sendMessage(message.chat, {
      video: { url: result.nowm },
      caption: `*🔹 تصميم مطلوب 🔹*\n\n📄 *العنوان*: ${result.title || 'بدون عنوان'}\n🌐 *الرابط*: ${result.link || result.nowm}`
    });
  } catch (error) {
    console.error('[TIKTOK DESIGN SEARCH]', error);
    await conn.sendMessage(message.chat, {
      text: `⚠️ حدث خطأ أثناء البحث: ${error.message}`
    });
  }
};

handler.help = ['تصميم <اسم أو نص>'];
handler.tags = ['search'];
handler.command = /^(تصميم|tiktokdesign)$/i;

export default handler;
