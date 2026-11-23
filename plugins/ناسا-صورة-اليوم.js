import axios from 'axios';

const handler = async (m, { conn }) => {
  try {
    const { data } = await axios.get('https://api.nasa.gov/planetary/apod', {
      params: { api_key: process.env.NASA_API_KEY || 'DEMO_KEY' },
      timeout: 15_000
    });
    const caption = `🚀 *صورة ناسا الفلكية لليوم*\n*${data.title || 'صورة اليوم'}*\n\n${data.explanation || ''}\n\nالمصدر: NASA`;
    if (data.media_type === 'image' && data.url) {
      await conn.sendMessage(m.chat, { image: { url: data.url }, caption }, { quoted: m });
    } else {
      await m.reply(`${caption}\n\nالمشاهدة: ${data.url || data.hdurl || 'غير متاحة'}`);
    }
  } catch (error) {
    console.error('[NASA APOD]', error);
    await m.reply('❌ تعذر جلب صورة ناسا الآن؛ قد يكون حد الاستخدام التجريبي قد انتهى.');
  }
};

handler.help = ['ناسا'];
handler.tags = ['tools'];
handler.command = /^(ناسا|nasa)$/i;

export default handler;
