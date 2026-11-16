import { createAtlasYoutubeSearchHandler } from '../lib/atlas-platform-downloader.js'

const videoSearch = createAtlasYoutubeSearchHandler()
const audioSearch = createAtlasYoutubeSearchHandler({ audioOnly: true })

const handler = async (m, context) => {
  const command = String(context.command || '').toLowerCase()
  return command === 'تشغيل_صوت' ? audioSearch(m, context) : videoSearch(m, context)
}

handler.help = [
  'تشغيل <اسم فيديو YouTube>',
  'تشغيل_صوت <اسم أغنية YouTube>',
]
handler.tags = ['download']
handler.command = /^(تشغيل|تشغيل_صوت)$/i

export default handler
