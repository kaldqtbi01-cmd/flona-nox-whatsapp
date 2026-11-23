import { downloadYoutubeBySearch } from '../lib/youtube-search-download.js'

const handler = async (m, { conn, text = '', command = '' }) => {
  const query = String(text || m.quoted?.text || m.quoted?.body || '').trim()
  const audioOnly = String(command).toLowerCase() === 'تشغيل_صوت'
  if (!query) {
    return m.reply(`اكتب اسم ${audioOnly ? 'الأغنية' : 'الفيديو'} بعد الأمر.\nمثال: .${command || (audioOnly ? 'تشغيل_صوت' : 'تشغيل')} Fairuz`)
  }

  let media
  try {
    await m.reply(`⏳ أبحث عن ${audioOnly ? 'الأغنية' : 'الفيديو'} وأجهزه للإرسال...`)
    media = await downloadYoutubeBySearch(query, { audioOnly })
    const payload = audioOnly
      ? { audio: { url: media.filePath }, mimetype: media.mimetype, fileName: `${media.title}.m4a`, ptt: false }
      : { video: { url: media.filePath }, mimetype: media.mimetype, caption: `🎬 ${media.title}` }
    await conn.sendMessage(m.chat, payload, { quoted: m })
    return 1
  } catch (error) {
    const reason = String(error?.message || 'تعذر البحث والتنزيل من YouTube.').slice(0, 500)
    await m.reply(`❌ تعذر تشغيل الوسائط من YouTube.\n${reason}`)
    return 0
  } finally {
    if (media?.cleanup) await media.cleanup().catch(() => {})
  }
}

handler.help = [
  'تشغيل <اسم فيديو YouTube>',
  'تشغيل_صوت <اسم أغنية YouTube>',
]
handler.tags = ['download']
handler.command = /^(تشغيل|تشغيل_صوت)$/i

export default handler
