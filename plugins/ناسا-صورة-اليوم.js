const decodeHtml = value => String(value || '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
  .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)));

const stripHtml = value => decodeHtml(String(value || '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim());

const handler = async (m, { conn }) => {
  try {
    let title;
    let explanation;
    let imageUrl;
    let isNonImage = false;

    if (process.env.NASA_API_KEY) {
      try {
        const apiUrl = new URL('https://api.nasa.gov/planetary/apod');
        apiUrl.searchParams.set('api_key', process.env.NASA_API_KEY);
        const response = await fetch(apiUrl, { signal: AbortSignal.timeout(15_000) });
        if (!response.ok) throw new Error(`NASA API HTTP ${response.status}`);
        const data = await response.json();
        title = data.title;
        explanation = data.explanation;
        imageUrl = data.media_type === 'image' ? (data.hdurl || data.url) : null;
        isNonImage = data.media_type !== 'image';
        if (isNonImage) {
          return m.reply(`🚀 *صورة ناسا الفلكية لليوم*\n*${title || 'صورة اليوم'}*\n\n${explanation || ''}\n\nالمشاهدة: ${data.url || 'https://science.nasa.gov/apod/'}`);
        }
      } catch (apiError) {
        console.error('[NASA API، استخدام صفحة ناسا كبديل]', apiError?.message || apiError);
      }
    }

    if (!imageUrl) {
      const pageResponse = await fetch('https://science.nasa.gov/apod/', {
        signal: AbortSignal.timeout(25_000),
        headers: { 'user-agent': 'Mozilla/5.0 (compatible; FlonaBot/1.0)' }
      });
      if (!pageResponse.ok) throw new Error(`NASA page HTTP ${pageResponse.status}`);
      const html = await pageResponse.text();
      const titleHtml = html.match(/<h2\b[^>]*class=["'][^"']*display-48[^"']*["'][^>]*>([\s\S]*?)<\/h2>/i)?.[1];
      const explanationHtml = html.match(/<p\b[^>]*class=["'][^"']*media-detail-hero__description[^"']*["'][^>]*>([\s\S]*?)<\/p>/i)?.[1];
      const imageTag = html.match(/<img\b(?=[^>]*\/apod\/apod\/)[^>]*>/i)?.[0];
      const rawImageUrl = imageTag?.match(/\bsrc=["']([^"']+)["']/i)?.[1];
      title = stripHtml(titleHtml);
      explanation = stripHtml(explanationHtml).replace(/^Explanation:\s*/i, '');
      imageUrl = rawImageUrl ? decodeHtml(rawImageUrl) : null;
      if (!title || !imageUrl) throw new Error('Could not parse NASA APOD page');
    }

    const imageResponse = await fetch(imageUrl, { signal: AbortSignal.timeout(30_000) });
    if (!imageResponse.ok) throw new Error(`NASA image HTTP ${imageResponse.status}`);
    const image = Buffer.from(await imageResponse.arrayBuffer());
    const caption = `🚀 *صورة ناسا الفلكية لليوم*\n*${title || 'صورة اليوم'}*\n\n${(explanation || '').slice(0, 1800)}\n\nالمصدر: NASA`;
    await conn.sendMessage(m.chat, {
      image,
      mimetype: imageResponse.headers.get('content-type') || 'image/jpeg',
      caption
    }, { quoted: m });
  } catch (error) {
    console.error('[NASA APOD]', error?.cause?.code || error?.message || error);
    await m.reply('❌ تعذر جلب صورة ناسا الآن؛ تحقق من اتصال الـVPS بالإنترنت وحاول مجددًا.');
  }
};

handler.help = ['ناسا'];
handler.tags = ['tools'];
handler.command = /^(ناسا|nasa)$/i;

export default handler;
