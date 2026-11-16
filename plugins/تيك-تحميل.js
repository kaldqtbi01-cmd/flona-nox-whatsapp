import axios from 'axios'

let handler = async (m, { conn, text }) => {
  const url = String(text || '').trim()
  if (!url) return m.reply('🎵 أرسل رابط تيك توك بعد الأمر.')
  if (!/tiktok\.com|vm\.tiktok\.com/i.test(url)) return m.reply('❌ الرابط ليس رابط تيك توك صحيحًا.')
  await m.reply('⏳ جاري تحميل الفيديو...')
  try {
    const { data } = await axios.get(`https://discardapi.onrender.com/api/dl/tiktok?apikey=guru&url=${encodeURIComponent(url)}`, { timeout: 60000 })
    const result = data?.result
    const list = result?.data || []
    const video = list.find(x => x.type === 'nowatermark_hd') || list.find(x => x.type === 'nowatermark')
    if (!video?.url) throw new Error('no video')
    return conn.sendMessage(m.chat, { video: { url: video.url }, caption: `🎵 ${result?.title || 'TikTok'}\n👤 ${result?.author?.nickname || ''}` }, { quoted: m })
  } catch {
    return m.reply('❌ تعذر تحميل الفيديو حاليًا، جرّب رابطًا آخر.')
  }
}
handler.help = ['تيك_تحميل <الرابط>']
handler.tags = ['downloader']
handler.command = /^(تيك_تحميل|تحميل_تيك)$/i
export default handler
