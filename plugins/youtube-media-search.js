import { downloadYoutubeBySearch } from '../lib/youtube-search-download.js'

const handler = async (m, { conn, text = '', command = '' }) => {
  const query = String(text || m.quoted?.text || m.quoted?.body || '').trim()
  const audioOnly = String(command).toLowerCase() === 'اغنية'
  const kind = audioOnly ? 'الأغنية' : 'الفيديو'
  if (!query) {
    return m.reply(`اكتب اسم ${kind} أو رابط YouTube بعد الأمر.\nمثال: .${command || (audioOnly ? 'اغنية' : 'فيديو')} Fairuz`)
  }

  let media
  try {
    await m.reply(`⏳ أبحث عن ${kind} وأجهزه للإرسال...`)
    media = await downloadYoutubeBySearch(query, { audioOnly })
    const safeTitle = media.title.replace(/[\\/:*?"<>|\u0000-\u001f]/g, ' ').trim().slice(0, 100) || 'youtube-media'
    const payload = audioOnly
      ? { audio: { url: media.filePath }, mimetype: media.mimetype, fileName: `${safeTitle}.m4a`, ptt: false }
      : { video: { url: media.filePath }, mimetype: media.mimetype, caption: `🎬 ${media.title}` }
    await conn.sendMessage(m.chat, payload, { quoted: m })
    return 1
  } catch (error) {
    const reason = String(error?.message || 'تعذر البحث والتنزيل من YouTube.').slice(0, 500)
    await m.reply(`❌ تعذر إرسال ${kind} من YouTube.\n${reason}`)
    return 0
  } finally {
    if (media?.cleanup) await media.cleanup().catch(() => {})
  }
}

handler.help = [
  'فيديو <اسم أو رابط YouTube>',
  'اغنية <اسم أو رابط YouTube>',
]
handler.tags = ['download']
handler.command = /^(فيديو|اغنية)$/i

export default handler
